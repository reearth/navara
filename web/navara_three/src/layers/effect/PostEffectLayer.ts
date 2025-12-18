import { Vector2, type Texture } from "three";

import { BufferView } from "../../bufferView";
import {
  EffectLayerDeclaration,
  type EffectLayerConfig,
  type EffectLayerUpdate,
} from "../../core/EffectLayerDeclaration";
import { type PostEffectResources } from "../../core/PostEffectHelper";
import type { ViewContext } from "../../core/ViewContext";

import type { MRTPassEffectLayer } from "./MRTPassEffectLayer";

// Re-export utilities from PostEffectHelper for backward compatibility
export {
  type RendererState,
  saveRendererState,
  restoreRendererState,
  renderMaskForMode,
  createDepthClipMaterial,
  createFullscreenQuad,
  applyDepthClip,
} from "../../core/PostEffectHelper";

// Base configuration for post effect layers
// Note: resolutionScale and debugMask are defined in each effect-specific config (e.g., bloom, outline)
export type PostEffectLayerConfig = {
  postEffect: true;
} & EffectLayerConfig;

export type PostEffectLayerUpdate = EffectLayerUpdate;

/**
 * Base class for post effect layers
 * Provides mask rendering and debug visualization
 */
export abstract class PostEffectLayer<
  Config extends PostEffectLayerConfig = PostEffectLayerConfig,
  UpdateConfig extends PostEffectLayerUpdate = PostEffectLayerUpdate,
> extends EffectLayerDeclaration<Config, UpdateConfig> {
  protected resources!: PostEffectResources;
  protected config: Config;
  protected abstract getEffectKey(): string;

  /** Get resolution scale from effect-specific config (e.g., bloom.resolutionScale) */
  protected abstract getResolutionScale(): number;

  /** Get debug mask flag from effect-specific config (e.g., bloom.debugMask) */
  protected abstract getDebugMask(): boolean;

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
  public get postEffectResources(): PostEffectResources {
    return this.resources;
  }

  onCreate(): void {
    // Create post effect resources
    if (!this.view.postEffectRegistry) {
      throw new Error("PostEffectRegistry not initialized");
    }

    // Get values from effect-specific config via abstract methods
    const debugMask =
      this.getDebugMask() || this.view.debugOptions.postEffectMask || false;

    this.resources = this.view.postEffectRegistry.create(
      this.id,
      this.getEffectKey(),
      {
        resolutionScale: this.getResolutionScale(),
        debugMask,
      },
    );

    super.onCreate();
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
    // Note: resolutionScale and debugMask updates are handled by subclasses
    // via updateResolutionScale() and updateDebugMask() helper methods
  }

  /**
   * Helper method for subclasses to update resolution scale
   * Call this when effect-specific resolutionScale changes (e.g., updates.bloom.resolutionScale)
   */
  protected updateResolutionScale(resolutionScale: number): void {
    if (!this.view.postEffectRegistry) return;

    this.resources.options.resolutionScale = resolutionScale;
    const renderer =
      this.view.renderPassOrchestrator.effectComposer.getRenderer();
    const size = renderer.getSize(new Vector2());
    this.view.postEffectRegistry.setSize(size.x, size.y);
  }

  /**
   * Helper method for subclasses to update debug mask
   * Call this when effect-specific debugMask changes (e.g., updates.bloom.debugMask)
   */
  protected updateDebugMask(debugMask: boolean): void {
    this.resources.options.debugMask = debugMask;

    // Recreate debug view if needed
    if (debugMask && !this.resources.maskDebug) {
      this.resources.maskDebug = new BufferView(
        this.resources.maskRT.width,
        this.resources.maskRT.height,
      );
    } else if (!debugMask && this.resources.maskDebug) {
      this.resources.maskDebug.dispose();
      this.resources.maskDebug = undefined;
    }
  }

  onDestroy(): void {
    if (this.view.postEffectRegistry) {
      this.view.postEffectRegistry.destroy(this.id);
    }
    super.onDestroy();
  }
}
