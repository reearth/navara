import { Vector2, type Texture } from "three";

import { BufferView } from "../../bufferView";
import {
  EffectDeclaration,
  type EffectConfig,
  type EffectUpdate,
} from "../../core/EffectDeclaration";
import { type SelectiveEffectResources } from "../../core/SelectiveEffectHelper";
import type { ViewContext } from "../../core/ViewContext";
import type { CustomRenderPass } from "../../passes";

import type { MRTPassEffectDeclaration } from "./MRTPassEffectDeclaration";

// Re-export utilities from SelectiveEffectHelper for backward compatibility
export {
  createDepthClipMaterial,
  createFullscreenQuad,
  applyDepthClip,
} from "../../core/SelectiveEffectHelper";

// Base configuration for selective effect layers
// Note: resolutionScale and debugViews are defined in each effect-specific config (e.g., bloom, outline)
export type SelectiveEffectDeclarationConfig = {
  selectiveEffect: true;
} & EffectConfig;

export type SelectiveEffectDeclarationUpdate = EffectUpdate;

/**
 * Base class for selective effect layers.
 * Provides resource management, mask RT registration with CustomRenderPass,
 * and debug visualization helpers.
 * Mask rendering is handled by CustomRenderPass via MaskPassContext.
 */
export abstract class SelectiveEffectDeclaration<
  Config extends SelectiveEffectDeclarationConfig = SelectiveEffectDeclarationConfig,
  UpdateConfig extends SelectiveEffectDeclarationUpdate = SelectiveEffectDeclarationUpdate,
> extends EffectDeclaration<Config, UpdateConfig> {
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

    // Register maskRT with CustomRenderPass for context-based mask rendering
    this.registerMaskRenderTarget();

    super.onCreate();
  }

  /**
   * Register this layer's maskRT with CustomRenderPass.
   * This enables context-based mask rendering during BaseMRT phase.
   *
   * Override this method in subclasses that need occlusion mode-specific RTs
   * (e.g., PostEffectBloomLayer, PostEffectOutlineLayer).
   */
  protected registerMaskRenderTarget(): void {
    const mrtPass = this.findLayer<MRTPassEffectDeclaration>("mrt");
    const customRenderPass = mrtPass?.raw as CustomRenderPass | undefined;

    if (customRenderPass?.setMaskRenderTarget) {
      customRenderPass.setMaskRenderTarget(
        this.getEffectKey(),
        this.resources.maskRT,
      );
    }
  }

  /**
   * Unregister this layer's maskRT from CustomRenderPass.
   *
   * Override this method in subclasses that need occlusion mode-specific RTs.
   */
  protected unregisterMaskRenderTarget(): void {
    const mrtPass = this.findLayer<MRTPassEffectDeclaration>("mrt");
    const customRenderPass = mrtPass?.raw as CustomRenderPass | undefined;

    if (customRenderPass?.removeMaskRenderTarget) {
      customRenderPass.removeMaskRenderTarget(this.getEffectKey());
    }
  }

  /**
   * Get CustomRenderPass for mask registration.
   * Used by subclasses and Pass classes for occlusion-specific RT registration.
   */
  public getCustomRenderPass(): CustomRenderPass | undefined {
    const mrtPass = this.findLayer<MRTPassEffectDeclaration>("mrt");
    return mrtPass?.raw as CustomRenderPass | undefined;
  }

  /**
   * Render debug mask visualization
   */
  public renderDebugMask(): void {
    if (!this.resources.maskDebug) return;

    this.resources.maskDebug.render(
      this.view.getRenderer(),
      this.resources.maskRT,
    );
  }

  /**
   * Get the base depth texture from MRT pass for depth comparison
   * Uses allDepthCopyPass.texture which contains the entire scene depth (globe + MRT + opaque)
   * Format: RGBA packed depth, requires unpackRGBAToDepth() in shader
   */
  public getBaseDepthTexture(): Texture | null {
    const mrtPass = this.findLayer<MRTPassEffectDeclaration>("mrt");
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
    const renderer = this.view.getRenderer();
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
    // Unregister maskRT from CustomRenderPass
    this.unregisterMaskRenderTarget();

    if (this.view.selectiveEffectRegistry) {
      this.view.selectiveEffectRegistry.destroy(this.id);
    }
    super.onDestroy();
  }
}
