import { DepthCopyPass } from "postprocessing";
import {
  Color,
  Vector2,
  RGBADepthPacking,
  Mesh,
  MeshStandardMaterial,
  MeshPhysicalMaterial,
  type WebGLRenderer,
} from "three";

import { BufferView } from "../../bufferView";
import {
  EffectLayerDeclaration,
  type EffectLayerConfig,
  type EffectLayerUpdate,
} from "../../core/EffectLayerDeclaration";
import {
  ensurePostEffectUserData,
  type PostEffectResources,
} from "../../core/SelectiveEffectRegistry";
import type { ViewContext } from "../../core/ViewContext";
import { CustomRenderPass } from "../../passes";

// Base configuration for post effects
export type PostEffectConfig = {
  postEffect: true;
  resolutionScale?: number;
  debugMask?: boolean;
} & EffectLayerConfig;

export type PostEffectUpdate = {
  resolutionScale?: number;
  debugMask?: boolean;
} & EffectLayerUpdate;

// PostEffect Bloom configuration
export type PostEffectBloomConfig = {
  postEffect: true;
  postEffectBloom: {
    strength?: number;
    radius?: number;
    threshold?: number;
    debugMode?: number; // 0: normal, 1: base only, 2: bloom only, 3: bloom enhanced
  };
  resolutionScale?: number;
  debugMask?: boolean;
} & EffectLayerConfig;

export type PostEffectBloomUpdate = {
  postEffectBloom?: {
    strength?: number;
    radius?: number;
    threshold?: number;
    debugMode?: number; // 0: normal, 1: base only, 2: bloom only, 3: bloom enhanced
  };
  resolutionScale?: number;
  debugMask?: boolean;
} & EffectLayerUpdate;

// PostEffect Outline configuration
export type PostEffectOutlineConfig = {
  postEffect: true;
  postEffectOutline: {
    color?: number;
    thickness?: number;
    edgeStrength?: number;
  };
  resolutionScale?: number;
  debugMask?: boolean;
} & EffectLayerConfig;

export type PostEffectOutlineUpdate = {
  postEffectOutline?: {
    color?: number;
    thickness?: number;
    edgeStrength?: number;
  };
  resolutionScale?: number;
  debugMask?: boolean;
} & EffectLayerUpdate;

/**
 * Base class for post effect layers
 * Provides mask rendering and debug visualization
 */
export abstract class PostEffectLayerBase<
  Config extends PostEffectConfig = PostEffectConfig,
  UpdateConfig extends PostEffectUpdate = PostEffectUpdate,
> extends EffectLayerDeclaration<Config, UpdateConfig> {
  protected resources!: PostEffectResources;
  protected config: Config;
  private depthCopyPass: DepthCopyPass;

  constructor(view: ViewContext, config: Config) {
    super(view, config);
    this.config = config;

    // Initialize depth copy pass for reusing depth from CustomRenderPass
    this.depthCopyPass = new DepthCopyPass({
      depthPacking: RGBADepthPacking,
    });
  }

  onCreate(): void {
    // Create post effect resources
    if (!this.view.postEffectRegistry) {
      throw new Error("PostEffectRegistry not initialized");
    }

    const debugMask =
      this.config.debugMask ?? this.view.debugOptions.postEffectMask ?? false;
    this.config.debugMask = debugMask;

    this.resources = this.view.postEffectRegistry.create(this.id, {
      resolutionScale: this.config.resolutionScale ?? 1.0,
      debugMask,
    });

    super.onCreate();
  }

  /**
   * Render mask to maskRT
   * Uses separate scenes for depthTest enabled/disabled objects.
   *
   * Performance notes:
   * - Traversal is limited to post-effect clone scenes (not the main world scene)
   * - Reuses depth from CustomRenderPass to avoid expensive MRT scene rendering
   * - Keeps existing vertex/fragment shaders (no renderer.overrideMaterial)
   * - Mask behavior is controlled per-object via PostEffectRegistry
   */
  protected renderMask(renderer: WebGLRenderer): void {
    const { sceneDepthEnabled, sceneDepthDisabled, maskRT } = this.resources;

    // Collect unique materials from both scenes to toggle mask mode / depthTest
    const materials = new Set<MeshStandardMaterial | MeshPhysicalMaterial>();
    const originalDepthTest = new Map<
      MeshStandardMaterial | MeshPhysicalMaterial,
      boolean
    >();

    // First pass: occlusion-enabled group (depthTest = true, maskMode = 1.0)
    sceneDepthEnabled.traverse((obj) => {
      if (obj instanceof Mesh) {
        const m = obj.material;
        const arr = Array.isArray(m) ? m : [m];
        for (const mat of arr) {
          if (
            mat instanceof MeshStandardMaterial ||
            mat instanceof MeshPhysicalMaterial
          ) {
            const ud = ensurePostEffectUserData(mat);
            ud.maskMode.value = 1.0;
            if (!originalDepthTest.has(mat)) {
              originalDepthTest.set(mat, mat.depthTest);
            }
            materials.add(mat);
          }
        }
      }
    });

    // Second pass: occlusion-disabled group (depthTest = false, maskMode = 0.5)
    sceneDepthDisabled.traverse((obj) => {
      if (obj instanceof Mesh) {
        const m = obj.material;
        const arr = Array.isArray(m) ? m : [m];
        for (const mat of arr) {
          if (
            mat instanceof MeshStandardMaterial ||
            mat instanceof MeshPhysicalMaterial
          ) {
            const ud = ensurePostEffectUserData(mat);
            ud.maskMode.value = 0.5;
            if (!originalDepthTest.has(mat)) {
              originalDepthTest.set(mat, mat.depthTest);
            }
            materials.add(mat);
          }
        }
      }
    });

    // Get MRT pass to reuse its depth buffer
    const mrtPass = this.view.renderPassOrchestrator.getPass("mrt");
    if (!mrtPass || !(mrtPass instanceof CustomRenderPass)) {
      throw new Error("MRT pass not found or invalid type");
    }

    // Save renderer state
    const originalClearColor = new Color();
    renderer.getClearColor(originalClearColor);
    const originalClearAlpha = renderer.getClearAlpha();
    const prevRenderTarget = renderer.getRenderTarget();

    // Set up for mask rendering
    renderer.setRenderTarget(maskRT);
    renderer.setClearColor(0x000000, 1);
    renderer.clear(true, true, true);

    // 1. Copy depth from CustomRenderPass (avoids expensive MRT scene rendering)
    // CustomRenderPass.allDepthCopyPass already contains all depth information
    // from globe, MRT, and opaque scenes
    this.depthCopyPass.setDepthTexture(mrtPass.allDepthCopyPass.texture);
    this.depthCopyPass.render(renderer, maskRT, null);

    // Set actual renderTarget again because it's changed in copy pass
    renderer.setRenderTarget(maskRT);

    // 2. Render mask silhouettes with depthTest enabled
    for (const mat of materials) {
      mat.depthTest = true;
    }
    renderer.render(sceneDepthEnabled, this.view.camera);

    // 3. Render mask silhouettes with depthTest disabled
    for (const mat of materials) {
      mat.depthTest = false;
    }
    renderer.render(sceneDepthDisabled, this.view.camera);

    // Restore renderer state
    renderer.setRenderTarget(prevRenderTarget);
    renderer.setClearColor(originalClearColor, originalClearAlpha);

    // Reset mask mode and depthTest
    for (const mat of materials) {
      const ud = ensurePostEffectUserData(mat);
      ud.maskMode.value = 0;
      const original = originalDepthTest.get(mat);
      if (original !== undefined) {
        mat.depthTest = original;
      }
    }
  }

  /**
   * Render debug mask visualization
   */
  protected renderDebugMask(): void {
    if (!this.resources.maskDebug) return;

    this.resources.maskDebug.render(
      this.view.renderPassOrchestrator.effectComposer.getRenderer(),
      this.resources.maskRT,
    );
  }

  onUpdateConfig(updates: UpdateConfig): void {
    super.onUpdateConfig(updates);

    if (updates.resolutionScale !== undefined && this.view.postEffectRegistry) {
      // Update resolution scale
      this.resources.options.resolutionScale = updates.resolutionScale;
      const renderer =
        this.view.renderPassOrchestrator.effectComposer.getRenderer();
      const size = renderer.getSize(new Vector2());
      this.view.postEffectRegistry.setSize(size.x, size.y);
    }

    if (updates.debugMask !== undefined) {
      this.config.debugMask = updates.debugMask;
      this.resources.options.debugMask = updates.debugMask;
      // Recreate debug view if needed
      if (updates.debugMask && !this.resources.maskDebug) {
        this.resources.maskDebug = new BufferView(
          this.resources.maskRT.width,
          this.resources.maskRT.height,
        );
      } else if (!updates.debugMask && this.resources.maskDebug) {
        this.resources.maskDebug.dispose();
        this.resources.maskDebug = undefined;
      }
    }
  }

  onDestroy(): void {
    // Dispose depth copy pass
    this.depthCopyPass.dispose();

    if (this.view.postEffectRegistry) {
      this.view.postEffectRegistry.destroy(this.id);
    }
    super.onDestroy();
  }
}
