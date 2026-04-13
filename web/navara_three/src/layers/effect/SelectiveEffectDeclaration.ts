import { OrthographicCamera, PlaneGeometry, type Texture } from "three";

import {
  EffectDeclaration,
  type EffectConfig,
  type EffectUpdate,
} from "../../core/EffectDeclaration";
import { type SelectiveEffectResources } from "../../core/SelectiveEffectHelper";
import type { ViewContext } from "../../core/ViewContext";

import type { MRTPassEffectDeclaration } from "./MRTPassEffectDeclaration";

// Base configuration for selective effect layers
// Note: resolutionScale and debugViews are defined in each effect-specific config (e.g., bloom, outline)
export type SelectiveEffectDeclarationConfig = {
  selectiveEffect: true;
} & EffectConfig;

export type SelectiveEffectDeclarationUpdate = EffectUpdate;

/**
 * Create fullscreen rendering infrastructure for selective effect passes.
 */
export function createFullscreenQuad(): {
  camera: OrthographicCamera;
  geometry: PlaneGeometry;
} {
  return {
    camera: new OrthographicCamera(-1, 1, 1, -1, 0, 1),
    geometry: new PlaneGeometry(2, 2),
  };
}

/**
 * Base class for buffer-based selective effect layers (Bloom, Outline, etc.).
 *
 * Manages effect key registration, EffectIds Buffer slot allocation, and
 * provides MRT buffer accessors for subclass passes.
 *
 * Subclasses implement {@link createPass}.
 */
export abstract class SelectiveEffectDeclaration<
  Config extends SelectiveEffectDeclarationConfig = SelectiveEffectDeclarationConfig,
  UpdateConfig extends SelectiveEffectDeclarationUpdate = SelectiveEffectDeclarationUpdate,
> extends EffectDeclaration<Config, UpdateConfig> {
  protected resources!: SelectiveEffectResources;
  protected config: Config;

  constructor(view: ViewContext, config: Config) {
    super(view, config);
    this.config = config;
  }

  // ---------------------------------------------------------------------------
  // Public API for Pass classes
  // ---------------------------------------------------------------------------

  /** ViewContext for accessing camera, scenes, renderer, registry, etc. */
  public get viewContext(): ViewContext {
    return this.view;
  }

  /** Layer configuration (typed per subclass). */
  public get layerConfig(): Config {
    return this.config;
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  onCreate(): void {
    const registry = this.view.selectiveEffectRegistry;
    if (!registry) {
      throw new Error(
        "SelectiveEffectRegistry not initialized. Ensure MRTPassEffectLayer is added before selective effect layers.",
      );
    }

    // Allocate a slot bit in the EffectIds Buffer
    registry.registerSlot(this.id);

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
    const registry = this.view.selectiveEffectRegistry;

    // Release slot bit in the EffectIds Buffer
    registry?.unregisterSlot(this.id);

    super.onDestroy();
  }

  // ---------------------------------------------------------------------------
  // Buffer accessors — used by subclass passes to read MRT data
  // ---------------------------------------------------------------------------

  /** Emissive RGB buffer (MRT attachment[3]). */
  public getEmissiveBuffer(): Texture | null {
    const mrtLayer = this.findLayer<MRTPassEffectLayer>("mrt");
    return mrtLayer?.emissiveBuffer ?? null;
  }

  /** EffectIds bitmask buffer (MRT attachment[2]). NearestFilter, discrete data. */
  public getEffectIdsBuffer(): Texture | null {
    const mrtLayer = this.findLayer<MRTPassEffectLayer>("mrt");
    return mrtLayer?.effectIdsBuffer ?? null;
  }

  /** Slot bit index for this effect instance in the EffectIds Buffer. -1 if unregistered. */
  public getEffectSlot(): number {
    return this.view.selectiveEffectRegistry?.getSlot(this.id) ?? -1;
  }
}
