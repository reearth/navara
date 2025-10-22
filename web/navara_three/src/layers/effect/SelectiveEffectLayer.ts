import { Color, MeshBasicMaterial, Vector2, type WebGLRenderer } from "three";

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

// Mask material for rendering white silhouettes
const MASK_MATERIAL = new MeshBasicMaterial({
  color: new Color(1, 1, 1),
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
   * Uses white material to create silhouettes
   */
  protected renderMask(renderer: WebGLRenderer): void {
    const { scene, maskRT } = this.resources;

    // Save renderer state
    const originalClearColor = new Color();
    renderer.getClearColor(originalClearColor);
    const originalClearAlpha = renderer.getClearAlpha();
    const prevRenderTarget = renderer.getRenderTarget();

    // Set up for mask rendering
    renderer.setClearColor(0x000000, 1);
    scene.overrideMaterial = MASK_MATERIAL;

    // Render mask
    renderer.setRenderTarget(maskRT);
    renderer.clear(true, true, true);
    renderer.render(scene, this.view.camera);

    // Restore renderer state
    scene.overrideMaterial = null;
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
    if (this.view.selectiveRegistry) {
      this.view.selectiveRegistry.destroy(this.id);
    }
    super.onDestroy();
  }
}
