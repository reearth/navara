import type { Texture } from "three";

import {
  EffectLayerDeclaration,
  type EffectLayerConfig,
  type EffectLayerUpdate,
} from "../../core/EffectLayerDeclaration";
import type { ViewContext } from "../../core/ViewContext";

import type { MRTPassEffectLayer } from "./MRTPassEffectLayer";

// Re-export utility from SelectiveEffectHelper
export { createFullscreenQuad } from "../../core/SelectiveEffectHelper";

// Base configuration for selective effect layers
export type SelectiveEffectLayerConfig = {
  selectiveEffect: true;
} & EffectLayerConfig;

export type SelectiveEffectLayerUpdate = EffectLayerUpdate;

/**
 * Base class for buffer-based selective effect layers (Bloom, Outline, etc.).
 *
 * Manages effect key registration, EffectIds Buffer slot allocation, and
 * provides MRT buffer accessors for subclass passes.
 *
 * Subclasses implement {@link getEffectKey} and {@link createPass}.
 */
export abstract class SelectiveEffectLayer<
  Config extends SelectiveEffectLayerConfig = SelectiveEffectLayerConfig,
  UpdateConfig extends SelectiveEffectLayerUpdate = SelectiveEffectLayerUpdate,
> extends EffectLayerDeclaration<Config, UpdateConfig> {
  protected config: Config;
  protected abstract getEffectKey(): string;

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
    // Register effectId → effectKey mapping in SelectiveEffectHelper
    this.view.selectiveEffectRegistry?.registerEffectKey(
      this.id,
      this.getEffectKey(),
    );

    // Allocate a slot bit in the EffectIds Buffer for this effect instance
    const mrtLayer = this.findLayer<MRTPassEffectLayer>("mrt");
    mrtLayer?.effectSlotRegistry.register(this.id);

    super.onCreate();
  }

  onDestroy(): void {
    // Release effectId → effectKey mapping
    this.view.selectiveEffectRegistry?.unregisterEffectKey(this.id);

    // Release slot bit in the EffectIds Buffer
    const mrtLayer = this.findLayer<MRTPassEffectLayer>("mrt");
    mrtLayer?.effectSlotRegistry.unregister(this.id);

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
    const mrtLayer = this.findLayer<MRTPassEffectLayer>("mrt");
    return mrtLayer?.effectSlotRegistry.getSlot(this.id) ?? -1;
  }
}
