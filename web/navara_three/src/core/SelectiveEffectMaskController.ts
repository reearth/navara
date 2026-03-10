import {
  Color,
  DepthTexture,
  RGBAFormat,
  UnsignedShortType,
  WebGLRenderTarget,
  type WebGLRenderer,
} from "three";

import {
  SELECTIVE_BLOOM_EFFECT_KEY,
  SELECTIVE_OUTLINE_EFFECT_KEY,
  SelectiveEffectOcclusionMode,
  type SelectiveEffectHelper,
} from "./SelectiveEffectHelper";
import {
  MaskPassPhase,
  setMaskPassContext,
  resetMaskPassContext,
} from "./SelectiveEffectMaskContext";

/**
 * Controller for SelectiveEffect mask rendering.
 *
 * Owns combined mask render targets and orchestrates per-occlusion rendering.
 * Combined RT packs bloom (RGB) and outline (A) into a single vec4 per pixel,
 * reducing mask passes from effect × occlusion = 4 to occlusion-only = 2.
 */
export class SelectiveEffectMaskController {
  /** Combined mask RT for Normal occlusion (depthTest=true) */
  private combinedNormalMaskRT?: WebGLRenderTarget;

  /** Combined mask RT for Silhouette occlusion (depthTest=false) */
  private combinedSilhouetteMaskRT?: WebGLRenderTarget;

  /** Current RT dimensions */
  private width = 0;
  private height = 0;

  // ============================================================================
  // Public API
  // ============================================================================

  /**
   * Get the combined Normal mask RT.
   * Contains vec4(bloomColor.rgb, outlineA) for Normal occlusion mode.
   */
  getCombinedNormalMaskRT(): WebGLRenderTarget | undefined {
    return this.combinedNormalMaskRT;
  }

  /**
   * Get the combined Silhouette mask RT.
   * Contains vec4(bloomColor.rgb, outlineA) for Silhouette occlusion mode.
   */
  getCombinedSilhouetteMaskRT(): WebGLRenderTarget | undefined {
    return this.combinedSilhouetteMaskRT;
  }

  // ============================================================================
  // Mask Pass Rendering
  // ============================================================================

  /**
   * Render combined mask passes (per-occlusion, bloom+outline combined).
   *
   * Each mesh outputs vec4(bloomColor.rgb, outlineA) during mask pass.
   * The onBeforeRender handler sets per-mesh uBloomMaskPass/uOutlineMaskPass
   * uniforms based on the mesh's effectIds.
   *
   * @param renderer - WebGL renderer
   * @param baseRT - Base render target to restore after mask passes
   * @param renderFn - Function to render the MRT scene
   * @param registry - SelectiveEffectHelper for effect lookups
   */
  renderMaskPasses(
    renderer: WebGLRenderer,
    baseRT: WebGLRenderTarget,
    renderFn: () => void,
    registry?: SelectiveEffectHelper,
  ): void {
    if (!registry) return;

    // Determine which effects have any active objects
    const bloomActive =
      registry.getObjectsForEffect(SELECTIVE_BLOOM_EFFECT_KEY).size > 0;
    const outlineActive =
      registry.getObjectsForEffect(SELECTIVE_OUTLINE_EFFECT_KEY).size > 0;

    if (!bloomActive && !outlineActive) {
      // Clear combined RTs to avoid stale mask data from previous frames
      this.clearCombinedRTs(renderer);
      // Restore render target to match normal path behavior
      renderer.setRenderTarget(baseRT);
      return;
    }

    // Build active effects list
    const activeEffects: string[] = [];
    if (bloomActive) activeEffects.push(SELECTIVE_BLOOM_EFFECT_KEY);
    if (outlineActive) activeEffects.push(SELECTIVE_OUTLINE_EFFECT_KEY);

    // Ensure combined RTs exist and are sized correctly
    this.ensureCombinedRTs(baseRT.width, baseRT.height);

    // Save renderer state
    const savedClearColor = renderer.getClearColor(new Color());
    const savedClearAlpha = renderer.getClearAlpha();

    // Pass 1: Normal occlusion
    if (this.combinedNormalMaskRT) {
      this.renderCombinedPass(
        renderer,
        this.combinedNormalMaskRT,
        SelectiveEffectOcclusionMode.Normal,
        activeEffects,
        renderFn,
        registry,
      );
    }

    // Pass 2: Silhouette occlusion
    if (this.combinedSilhouetteMaskRT) {
      this.renderCombinedPass(
        renderer,
        this.combinedSilhouetteMaskRT,
        SelectiveEffectOcclusionMode.Silhouette,
        activeEffects,
        renderFn,
        registry,
      );
    }

    // Reset context after all mask passes
    resetMaskPassContext();

    // Restore renderer state
    renderer.setRenderTarget(baseRT);
    renderer.setClearColor(savedClearColor, savedClearAlpha);
  }

  // ============================================================================
  // Internal
  // ============================================================================

  /**
   * Clear combined RTs to prevent stale mask data when no effects are active.
   */
  private clearCombinedRTs(renderer: WebGLRenderer): void {
    if (!this.combinedNormalMaskRT && !this.combinedSilhouetteMaskRT) return;

    const savedClearColor = renderer.getClearColor(new Color());
    const savedClearAlpha = renderer.getClearAlpha();
    renderer.setClearColor(0x000000, 0);

    if (this.combinedNormalMaskRT) {
      renderer.setRenderTarget(this.combinedNormalMaskRT);
      renderer.clear();
    }
    if (this.combinedSilhouetteMaskRT) {
      renderer.setRenderTarget(this.combinedSilhouetteMaskRT);
      renderer.clear();
    }

    renderer.setClearColor(savedClearColor, savedClearAlpha);
  }

  /**
   * Render a combined mask pass for a specific occlusion mode.
   */
  private renderCombinedPass(
    renderer: WebGLRenderer,
    maskRT: WebGLRenderTarget,
    occlusionMode: (typeof SelectiveEffectOcclusionMode)[keyof typeof SelectiveEffectOcclusionMode],
    activeEffects: readonly string[],
    renderFn: () => void,
    registry: SelectiveEffectHelper,
  ): void {
    renderer.setRenderTarget(maskRT);
    renderer.setClearColor(0x000000, 0);
    renderer.clear();

    setMaskPassContext({
      phase: MaskPassPhase.BaseMRT,
      activeEffects,
      currentOcclusionMode: occlusionMode,
      registry,
    });

    renderFn();
  }

  /**
   * Ensure combined RTs exist and match the given dimensions.
   */
  private ensureCombinedRTs(width: number, height: number): void {
    if (this.width === width && this.height === height) return;

    this.width = width;
    this.height = height;

    // Dispose old RTs
    this.disposeCombinedRTs();

    // Normal mask RT (with depth texture for depth clip)
    this.combinedNormalMaskRT = new WebGLRenderTarget(width, height, {
      format: RGBAFormat,
      depthBuffer: true,
      stencilBuffer: true,
    });
    this.combinedNormalMaskRT.texture.name =
      "SelectiveEffect_CombinedNormalMask";
    this.combinedNormalMaskRT.depthTexture = new DepthTexture(
      width,
      height,
      UnsignedShortType,
    );

    // Silhouette mask RT (depth not needed for silhouette processing,
    // but required during rendering since meshes still write depth)
    this.combinedSilhouetteMaskRT = new WebGLRenderTarget(width, height, {
      format: RGBAFormat,
      depthBuffer: true,
      stencilBuffer: true,
    });
    this.combinedSilhouetteMaskRT.texture.name =
      "SelectiveEffect_CombinedSilhouetteMask";
  }

  /**
   * Dispose combined RTs.
   */
  private disposeCombinedRTs(): void {
    if (this.combinedNormalMaskRT) {
      this.combinedNormalMaskRT.depthTexture?.dispose();
      this.combinedNormalMaskRT.dispose();
      this.combinedNormalMaskRT = undefined;
    }
    if (this.combinedSilhouetteMaskRT) {
      this.combinedSilhouetteMaskRT.dispose();
      this.combinedSilhouetteMaskRT = undefined;
    }
  }

  /**
   * Dispose all resources.
   */
  dispose(): void {
    this.disposeCombinedRTs();
  }
}
