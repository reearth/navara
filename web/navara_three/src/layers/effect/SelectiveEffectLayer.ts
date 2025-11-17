import { DepthCopyPass } from "postprocessing";
import {
  Color,
  MeshBasicMaterial,
  Vector2,
  DoubleSide,
  RGBADepthPacking,
  type WebGLRenderer,
} from "three";

import { BufferView } from "../../bufferView";
import {
  EffectLayerDeclaration,
  type EffectLayerConfig,
  type EffectLayerUpdate,
} from "../../core/EffectLayerDeclaration";
import type { SelectiveEffectResources } from "../../core/SelectiveEffectRegistry";
import type { ViewContext } from "../../core/ViewContext";
import { CustomRenderPass } from "../../passes";

// Base configuration for selective effects
export type SelectiveEffectConfig = {
  selective: true;
  resolutionScale?: number;
  debugMask?: boolean;
} & EffectLayerConfig;

export type SelectiveEffectUpdate = {
  resolutionScale?: number;
  debugMask?: boolean;
} & EffectLayerUpdate;

// Selective Bloom configuration
export type SelectiveBloomConfig = {
  selective: true;
  selectiveBloom: {
    strength?: number;
    radius?: number;
    threshold?: number;
    debugMode?: number; // 0: normal, 1: base only, 2: bloom only, 3: bloom enhanced
  };
  resolutionScale?: number;
  debugMask?: boolean;
} & EffectLayerConfig;

export type SelectiveBloomUpdate = {
  selectiveBloom?: {
    strength?: number;
    radius?: number;
    threshold?: number;
    debugMode?: number; // 0: normal, 1: base only, 2: bloom only, 3: bloom enhanced
  };
  resolutionScale?: number;
  debugMask?: boolean;
} & EffectLayerUpdate;

// Selective Outline configuration
export type SelectiveOutlineConfig = {
  selective: true;
  selectiveOutline: {
    color?: number;
    thickness?: number;
    edgeStrength?: number;
  };
  resolutionScale?: number;
  debugMask?: boolean;
} & EffectLayerConfig;

export type SelectiveOutlineUpdate = {
  selectiveOutline?: {
    color?: number;
    thickness?: number;
    edgeStrength?: number;
  };
  resolutionScale?: number;
  debugMask?: boolean;
} & EffectLayerUpdate;

// Mask material for rendering white silhouettes (depth enabled)
const MASK_MATERIAL_DEPTH_ENABLED = new MeshBasicMaterial({
  color: new Color(1, 1, 1),
  depthTest: true,
  depthWrite: true,
  side: DoubleSide, // Render both sides to handle model orientation
});

// Mask material for rendering white silhouettes (depth disabled)
const MASK_MATERIAL_DEPTH_DISABLED = new MeshBasicMaterial({
  color: new Color(1, 1, 1),
  depthTest: false,
  depthWrite: false,
  side: DoubleSide, // Render both sides to handle model orientation
});

/**
 * Base class for selective effect layers
 * Provides mask rendering and debug visualization
 */
export abstract class SelectiveEffectLayerBase<
  Config extends SelectiveEffectConfig = SelectiveEffectConfig,
  UpdateConfig extends SelectiveEffectUpdate = SelectiveEffectUpdate,
> extends EffectLayerDeclaration<Config, UpdateConfig> {
  protected resources!: SelectiveEffectResources;
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
    // Create selective effect resources
    if (!this.view.selectiveRegistry) {
      throw new Error("SelectiveEffectRegistry not initialized");
    }

    const debugMask =
      this.config.debugMask ??
      this.view.debugOptions.selectiveEffectMask ??
      false;
    this.config.debugMask = debugMask;

    this.resources = this.view.selectiveRegistry.create(this.id, {
      resolutionScale: this.config.resolutionScale ?? 1.0,
      debugMask,
    });

    super.onCreate();
  }

  /**
   * Render mask to maskRT
   * Uses separate scenes for depthTest enabled/disabled objects
   * This completely eliminates the need for scene traversal
   *
   * Performance optimizations:
   * - Zero scene.traverse() calls
   * - Uses overrideMaterial for fastest rendering
   * - No material cloning or restoration needed
   * - Reuses depth from CustomRenderPass to avoid expensive MRT scene rendering
   */
  protected renderMask(renderer: WebGLRenderer): void {
    const { sceneDepthEnabled, sceneDepthDisabled, maskRT } = this.resources;

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
    // overrideMaterial applies to all objects in scene - no traverse needed!
    sceneDepthEnabled.overrideMaterial = MASK_MATERIAL_DEPTH_ENABLED;
    renderer.render(sceneDepthEnabled, this.view.camera);
    sceneDepthEnabled.overrideMaterial = null;

    // 3. Render mask silhouettes with depthTest disabled
    // overrideMaterial applies to all objects in scene - no traverse needed!
    sceneDepthDisabled.overrideMaterial = MASK_MATERIAL_DEPTH_DISABLED;
    renderer.render(sceneDepthDisabled, this.view.camera);
    sceneDepthDisabled.overrideMaterial = null;

    // Restore renderer state
    renderer.setRenderTarget(prevRenderTarget);
    renderer.setClearColor(originalClearColor, originalClearAlpha);
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

    if (updates.resolutionScale !== undefined && this.view.selectiveRegistry) {
      // Update resolution scale
      this.resources.options.resolutionScale = updates.resolutionScale;
      const renderer =
        this.view.renderPassOrchestrator.effectComposer.getRenderer();
      const size = renderer.getSize(new Vector2());
      this.view.selectiveRegistry.setSize(size.x, size.y);
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

    if (this.view.selectiveRegistry) {
      this.view.selectiveRegistry.destroy(this.id);
    }
    super.onDestroy();
  }
}
