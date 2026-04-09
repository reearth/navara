import { Color, type WebGLRenderer, type WebGLRenderTarget } from "three";

import {
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
 * Manages mask render targets and orchestrates mask pass rendering.
 *
 * This separates SelectiveEffect-specific logic from CustomRenderPass,
 * keeping CustomRenderPass focused on BaseMRT rendering while
 * SelectiveEffectMaskController handles effect-specific knowledge.
 */
export class SelectiveEffectMaskController {
  // Simple mask RTs (single RT per effect, both occlusion modes to same RT)
  private maskRenderTargets = new Map<string, WebGLRenderTarget>();

  // Occlusion mode-specific mask RTs (separate RTs for Normal and Silhouette)
  private occlusionMaskRenderTargets = new Map<
    string,
    { normal?: WebGLRenderTarget; silhouette?: WebGLRenderTarget }
  >();

  // ============================================================================
  // Registration API
  // ============================================================================

  /**
   * Set mask render target for selective effect rendering.
   * Called by SelectiveEffectDeclaration to register their mask RTs.
   *
   * @param effectKey - Effect key (e.g., "selectiveBloom", "selectiveOutline")
   * @param rt - WebGLRenderTarget for mask rendering
   */
  setMaskRenderTarget(effectKey: string, rt: WebGLRenderTarget): void {
    this.maskRenderTargets.set(effectKey, rt);
  }

  /**
   * Remove mask render target.
   *
   * @param effectKey - Effect key to remove
   */
  removeMaskRenderTarget(effectKey: string): void {
    this.maskRenderTargets.delete(effectKey);
  }

  /**
   * Set occlusion mode-specific mask render targets.
   * Used by effects that need separate Normal and Silhouette masks (selectiveBloom, selectiveOutline).
   *
   * @param effectKey - Effect key (e.g., "selectiveBloom", "selectiveOutline")
   * @param targets - Object with optional normal and silhouette WebGLRenderTargets
   */
  setOcclusionMaskRenderTargets(
    effectKey: string,
    targets: { normal?: WebGLRenderTarget; silhouette?: WebGLRenderTarget },
  ): void {
    this.occlusionMaskRenderTargets.set(effectKey, targets);
  }

  /**
   * Remove occlusion mode-specific mask render targets.
   *
   * @param effectKey - Effect key to remove
   */
  removeOcclusionMaskRenderTargets(effectKey: string): void {
    this.occlusionMaskRenderTargets.delete(effectKey);
  }

  // ============================================================================
  // Mask Pass Rendering
  // ============================================================================

  /**
   * Render to all registered maskRTs.
   * Uses context-based mesh self-determination (no traverse needed).
   *
   * Each mesh determines its own mask contribution via onBeforeRender
   * by checking the MaskPassContext.
   *
   * Supports two registration modes:
   * 1. Simple: Single RT per effect (both occlusion modes to same RT)
   * 2. Occlusion-specific: Separate RTs for Normal and Silhouette
   *
   * @param renderer - WebGL renderer
   * @param baseRT - Base render target to restore after mask passes
   * @param renderFn - Function to render the MRT scene (delegate from CustomRenderPass)
   * @param registry - SelectiveEffectHelper for context
   */
  renderMaskPasses(
    renderer: WebGLRenderer,
    baseRT: WebGLRenderTarget,
    renderFn: () => void,
    registry?: SelectiveEffectHelper,
  ): void {
    // Skip if no SelectiveEffect infrastructure
    if (!registry) {
      return;
    }

    // Skip if no maskRTs registered (either simple or occlusion-specific)
    if (
      this.maskRenderTargets.size === 0 &&
      this.occlusionMaskRenderTargets.size === 0
    ) {
      return;
    }

    // Save renderer state
    const savedClearColor = renderer.getClearColor(new Color());
    const savedClearAlpha = renderer.getClearAlpha();

    // 1. Render to occlusion-specific maskRTs (bloom, outline)
    // Each occlusion mode gets its own RT
    for (const [effectKey, targets] of this.occlusionMaskRenderTargets) {
      // Skip if no objects have this effect enabled
      if (registry.getObjectsForEffect(effectKey).size === 0) {
        continue;
      }

      // Render Normal occlusion to normal RT
      if (targets.normal) {
        this.renderToMaskRT(
          renderer,
          effectKey,
          targets.normal,
          SelectiveEffectOcclusionMode.Normal,
          renderFn,
          registry,
        );
      }

      // Render Silhouette occlusion to silhouette RT
      if (targets.silhouette) {
        this.renderToMaskRT(
          renderer,
          effectKey,
          targets.silhouette,
          SelectiveEffectOcclusionMode.Silhouette,
          renderFn,
          registry,
        );
      }
    }

    // 2. Render to simple maskRTs (single RT per effect)
    // Both occlusion modes rendered to same RT
    for (const [effectKey, maskRT] of this.maskRenderTargets) {
      // Skip if this effect has occlusion-specific RTs
      if (this.occlusionMaskRenderTargets.has(effectKey)) {
        continue;
      }

      // Skip if no objects have this effect enabled
      if (registry.getObjectsForEffect(effectKey).size === 0) {
        continue;
      }

      // Set render target and clear once per effect
      renderer.setRenderTarget(maskRT);
      renderer.setClearColor(0x000000, 0);
      renderer.clear();

      // Render both occlusion modes to same RT
      for (const occlusionMode of [
        SelectiveEffectOcclusionMode.Normal,
        SelectiveEffectOcclusionMode.Silhouette,
      ]) {
        setMaskPassContext({
          phase: MaskPassPhase.BaseMRT,
          activeEffects: [effectKey],
          currentOcclusionMode: occlusionMode,
          maskRenderTargets: this.maskRenderTargets,
          registry,
        });

        renderFn();
      }
    }

    // Reset context after all mask passes
    resetMaskPassContext();

    // Restore renderer state
    renderer.setRenderTarget(baseRT);
    renderer.setClearColor(savedClearColor, savedClearAlpha);
  }

  /**
   * Render to a single maskRT for a specific occlusion mode.
   */
  private renderToMaskRT(
    renderer: WebGLRenderer,
    effectKey: string,
    maskRT: WebGLRenderTarget,
    occlusionMode: (typeof SelectiveEffectOcclusionMode)[keyof typeof SelectiveEffectOcclusionMode],
    renderFn: () => void,
    registry?: SelectiveEffectHelper,
  ): void {
    // Set render target and clear
    renderer.setRenderTarget(maskRT);
    renderer.setClearColor(0x000000, 0);
    renderer.clear();

    // Set context for this specific effect and occlusion mode
    setMaskPassContext({
      phase: MaskPassPhase.BaseMRT,
      activeEffects: [effectKey],
      currentOcclusionMode: occlusionMode,
      maskRenderTargets: this.maskRenderTargets,
      registry,
    });

    // Render MRT scene to maskRT
    renderFn();
  }
}
