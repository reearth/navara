import {
  Color,
  MeshBasicMaterial,
  Vector2,
  DoubleSide,
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
  bloom: {
    strength?: number;
    radius?: number;
    threshold?: number;
  };
  resolutionScale?: number;
  debugMask?: boolean;
} & EffectLayerConfig;

export type SelectiveBloomUpdate = {
  bloom?: {
    strength?: number;
    radius?: number;
    threshold?: number;
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

// Depth-only material for rendering depth from main scene
const DEPTH_ONLY_MATERIAL = new MeshBasicMaterial({
  colorWrite: false,
  depthTest: true,
  depthWrite: true,
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

  constructor(view: ViewContext, config: Config) {
    super(view, config);
    this.config = config;
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
   */
  protected renderMask(renderer: WebGLRenderer): void {
    const { sceneDepthEnabled, sceneDepthDisabled, maskRT } = this.resources;
    const mainScene = this.view.scenes.mrt;

    // Save renderer state
    const originalClearColor = new Color();
    renderer.getClearColor(originalClearColor);
    const originalClearAlpha = renderer.getClearAlpha();
    const prevRenderTarget = renderer.getRenderTarget();

    // Set up for mask rendering
    renderer.setRenderTarget(maskRT);
    renderer.setClearColor(0x000000, 1);
    renderer.clear(true, true, true);

    // 1. Render depth from main scene (all objects)
    // This ensures objects without effects contribute to depth buffer
    mainScene.overrideMaterial = DEPTH_ONLY_MATERIAL;
    renderer.render(mainScene, this.view.camera);
    mainScene.overrideMaterial = null;

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
   * Find layer ID for an object by its source ID
   */
  private findLayerIdForObject(sourceId: string): string | undefined {
    const cached = this.resources.objectLayerMap.get(sourceId);
    if (cached) {
      return cached;
    }
    // Check all registered layer effects
    for (const layer of this.view.layersManager.getResourceLayers()) {
      const effects = this.view.getLayerEffects(layer.id);
      if (effects && effects.includes(this.id)) {
        // This layer uses this effect, check if it has matching meshes
        // We need to traverse the layer's meshes to find the one with matching UUID
        // For now, return the layer ID if it uses this effect
        return layer.id;
      }
    }
    return undefined;
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
    if (this.view.selectiveRegistry) {
      this.view.selectiveRegistry.destroy(this.id);
    }
    super.onDestroy();
  }
}
