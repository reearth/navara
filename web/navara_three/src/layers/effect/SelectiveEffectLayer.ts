import { Vector2, type Texture } from "three";

import { BufferView } from "../../bufferView";
import {
  EffectLayerDeclaration,
  type EffectLayerConfig,
  type EffectLayerUpdate,
} from "../../core/EffectLayerDeclaration";
import { type SelectiveEffectResources } from "../../core/SelectiveEffectHelper";
import type { ViewContext } from "../../core/ViewContext";
import type { CustomRenderPass } from "../../passes";

import type { MRTPassEffectLayer } from "./MRTPassEffectLayer";

// Re-export utility used by SelectiveEffectPass
export { createFullscreenQuad } from "../../core/SelectiveEffectHelper";

// Base configuration for selective effect layers
// Note: resolutionScale and debugViews are defined in each effect-specific config (e.g., bloom, outline)
export type SelectiveEffectLayerConfig = {
  selectiveEffect: true;
} & EffectLayerConfig;

export type SelectiveEffectLayerUpdate = EffectLayerUpdate;

/**
 * Base class for selective effect layers.
 * Provides resource management, mask RT registration with CustomRenderPass,
 * and debug visualization helpers.
 * Mask rendering is handled by CustomRenderPass via MaskPassContext.
 */
export abstract class SelectiveEffectLayer<
  Config extends SelectiveEffectLayerConfig = SelectiveEffectLayerConfig,
  UpdateConfig extends SelectiveEffectLayerUpdate = SelectiveEffectLayerUpdate,
> extends EffectLayerDeclaration<Config, UpdateConfig> {
  protected resources!: SelectiveEffectResources;
  protected config: Config;
  protected abstract getEffectKey(): string;

  /** Get resolution scale from effect-specific config (e.g., bloom.resolutionScale) */
  protected abstract getResolutionScale(): number;

  /** Get debug views flag from effect-specific config (e.g., bloom.debugViews) */
  protected abstract getDebugViews(): boolean;

  constructor(view: ViewContext, config: Config) {
    super(view, config);
    this.config = config;
  }

  // ============================================
  // Public API for Pass classes
  // ============================================

  /**
   * Get the ViewContext for accessing camera, scenes, registry, etc.
   */
  public get viewContext(): ViewContext {
    return this.view;
  }

  /**
   * Get the layer configuration
   */
  public get layerConfig(): Config {
    return this.config;
  }

  /**
   * Get the PostEffect resources (maskRT, options, maskDebug)
   */
  public get selectiveEffectResources(): SelectiveEffectResources {
    return this.resources;
  }

  onCreate(): void {
    // Create selective effect resources
    if (!this.view.selectiveEffectRegistry) {
      throw new Error("SelectiveEffectRegistry not initialized");
    }

    // Get values from effect-specific config via abstract methods
    const debugViews =
      this.getDebugViews() ||
      this.view.debugOptions.selectiveEffectMask ||
      false;

    this.resources = this.view.selectiveEffectRegistry.create(
      this.id,
      this.getEffectKey(),
      {
        resolutionScale: this.getResolutionScale(),
        debugViews,
      },
    );

    super.onCreate();
  }

  /**
   * Get CustomRenderPass for combined mask RT access.
   * Used by SelectiveEffectPass to read combined Normal/Silhouette mask RTs.
   */
  public getCustomRenderPass(): CustomRenderPass | undefined {
    const mrtPass = this.findLayer<MRTPassEffectLayer>("mrt");
    return mrtPass?.raw as CustomRenderPass | undefined;
  }

  /**
   * Render debug mask visualization
   */
  public renderDebugMask(): void {
    if (!this.resources.maskDebug) return;

    this.resources.maskDebug.render(
      this.view.renderPassOrchestrator.effectComposer.getRenderer(),
      this.resources.maskRT,
    );
  }

  /**
   * Get the base depth texture from MRT pass for depth comparison
   * Uses allDepthCopyPass.texture which contains the entire scene depth (globe + MRT + opaque)
   * Format: RGBA packed depth, requires unpackRGBAToDepth() in shader
   */
  public getBaseDepthTexture(): Texture | null {
    const mrtPass = this.findLayer<MRTPassEffectLayer>("mrt");
    return mrtPass?.raw?.allDepthCopyPass?.texture ?? null;
  }

  onUpdateConfig(updates: UpdateConfig): void {
    super.onUpdateConfig(updates);
    // Note: resolutionScale and debugViews updates are handled by subclasses
    // via updateResolutionScale() and updateDebugViews() helper methods
  }

  /**
   * Helper method for subclasses to update resolution scale
   * Call this when effect-specific resolutionScale changes (e.g., updates.selectiveBloom.resolutionScale)
   */
  protected updateResolutionScale(resolutionScale: number): void {
    if (!this.view.selectiveEffectRegistry) return;

    this.resources.options.resolutionScale = resolutionScale;
    const renderer =
      this.view.renderPassOrchestrator.effectComposer.getRenderer();
    const size = renderer.getSize(new Vector2());
    this.view.selectiveEffectRegistry.setSize(size.x, size.y);
  }

  /**
   * Helper method for subclasses to update debug views
   * Call this when effect-specific debugViews changes (e.g., updates.selectiveBloom.debugViews)
   */
  protected updateDebugViews(debugViews: boolean): void {
    this.resources.options.debugViews = debugViews;

    // Recreate debug view if needed
    if (debugViews && !this.resources.maskDebug) {
      this.resources.maskDebug = new BufferView(
        this.resources.maskRT.width,
        this.resources.maskRT.height,
      );
    } else if (!debugViews && this.resources.maskDebug) {
      this.resources.maskDebug.dispose();
      this.resources.maskDebug = undefined;
    }
  }

  onDestroy(): void {
    if (this.view.selectiveEffectRegistry) {
      this.view.selectiveEffectRegistry.destroy(this.id);
    }
    super.onDestroy();
  }
}
