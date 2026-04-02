import { Vector2, type Texture } from "three";

import { BufferView } from "../../bufferView";
import {
  EffectLayerDeclaration,
  type EffectLayerConfig,
  type EffectLayerUpdate,
} from "../../core/EffectLayerDeclaration";
import { type SelectiveEffectResources } from "../../core/SelectiveEffectHelper";
import type { ViewContext } from "../../core/ViewContext";
// @deprecated SE Redesign — CustomRenderPass import kept for getCustomRenderPass signature
import type { CustomRenderPass } from "../../passes";

import type { MRTPassEffectLayer } from "./MRTPassEffectLayer";

// Re-export utilities from SelectiveEffectHelper for backward compatibility
export {
  createDepthClipMaterial,
  createFullscreenQuad,
  applyDepthClip,
} from "../../core/SelectiveEffectHelper";

// Base configuration for selective effect layers
// Note: resolutionScale and debugViews are defined in each effect-specific config (e.g., bloom, outline)
export type SelectiveEffectLayerConfig = {
  selectiveEffect: true;
  /** Occlusion mode for all effects in this layer (shared setting) */
  selectiveEffectOcclusion?: "normal" | "silhouette";
} & EffectLayerConfig;

export type SelectiveEffectLayerUpdate = EffectLayerUpdate;

/**
 * Base class for selective effect layers.
 * Provides resource management, mask RT registration with CustomRenderPass,
 * and debug visualization helpers.
 * Mask rendering is handled by CustomRenderPass via MaskPassContext.
 *
 * @deprecated SE Redesign — Mask RT registration and CustomRenderPass integration
 * will be replaced by the new SE architecture.
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

    // Register effect slot for EffectIds Buffer
    const mrtLayer = this.findLayer<MRTPassEffectLayer>("mrt");
    mrtLayer?.effectSlotRegistry.register(this.id);

    super.onCreate();
  }

  /**
   * Register this layer's maskRT with CustomRenderPass.
   * This enables context-based mask rendering during BaseMRT phase.
   *
   * Override this method in subclasses that need occlusion mode-specific RTs
   * (e.g., PostEffectBloomLayer, PostEffectOutlineLayer).
   *
   * @deprecated SE Redesign — mask RT registration will be replaced by the new SE architecture.
   */
  protected registerMaskRenderTarget(): void {
    // @deprecated SE Redesign — commented out mask RT registration
    // const mrtPass = this.findLayer<MRTPassEffectLayer>("mrt");
    // const customRenderPass = mrtPass?.raw as CustomRenderPass | undefined;
    //
    // if (customRenderPass?.setMaskRenderTarget) {
    //   customRenderPass.setMaskRenderTarget(
    //     this.getEffectKey(),
    //     this.resources.maskRT,
    //   );
    // }
  }

  /**
   * Unregister this layer's maskRT from CustomRenderPass.
   *
   * Override this method in subclasses that need occlusion mode-specific RTs.
   *
   * @deprecated SE Redesign — mask RT unregistration will be replaced by the new SE architecture.
   */
  protected unregisterMaskRenderTarget(): void {
    // @deprecated SE Redesign — commented out mask RT unregistration
    // const mrtPass = this.findLayer<MRTPassEffectLayer>("mrt");
    // const customRenderPass = mrtPass?.raw as CustomRenderPass | undefined;
    //
    // if (customRenderPass?.removeMaskRenderTarget) {
    //   customRenderPass.removeMaskRenderTarget(this.getEffectKey());
    // }
  }

  /**
   * @deprecated SE Redesign — Mask-based pipeline is disabled. Always returns undefined.
   */
  public getCustomRenderPass(): CustomRenderPass | undefined {
    return undefined;
  }

  /** Get the emissive buffer texture from MRT pass */
  public getEmissiveBuffer(): Texture | null {
    const mrtLayer = this.findLayer<MRTPassEffectLayer>("mrt");
    return mrtLayer?.emissiveBuffer ?? null;
  }

  /** Get the effectIds buffer texture from MRT pass */
  public getEffectIdsBuffer(): Texture | null {
    const mrtLayer = this.findLayer<MRTPassEffectLayer>("mrt");
    return mrtLayer?.effectIdsBuffer ?? null;
  }

  /** Get this effect's slot number (0=R, 1=G, 2=B). -1 if not registered */
  public getEffectSlot(): number {
    const mrtLayer = this.findLayer<MRTPassEffectLayer>("mrt");
    return mrtLayer?.effectSlotRegistry.getSlot(this.id) ?? -1;
  }

  /**
   * Render debug mask visualization
   *
   * @deprecated SE Redesign — debug mask visualization will be replaced by the new SE architecture.
   */
  public renderDebugMask(): void {
    // @deprecated SE Redesign — commented out mask debug rendering
    // if (!this.resources.maskDebug) return;
    //
    // this.resources.maskDebug.render(
    //   this.view.renderPassOrchestrator.effectComposer.getRenderer(),
    //   this.resources.maskRT,
    // );
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
    // Unregister effect slot
    const mrtLayer = this.findLayer<MRTPassEffectLayer>("mrt");
    mrtLayer?.effectSlotRegistry.unregister(this.id);

    if (this.view.selectiveEffectRegistry) {
      this.view.selectiveEffectRegistry.destroy(this.id);
    }
    super.onDestroy();
  }
}
