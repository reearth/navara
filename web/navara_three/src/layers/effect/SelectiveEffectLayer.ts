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
  /**
   * Occlusion mode for selective effects.
   * - "normal": Standard depth test (default)
   * - "silhouette": Renders behind occluders
   *
   * Note: Currently stored in ViewContext but not yet wired
   * into the buffer-based pipeline. Will be implemented with Silhouette support.
   */
  selectiveEffectOcclusion?: "normal" | "silhouette";
} & EffectLayerConfig;

export type SelectiveEffectLayerUpdate = EffectLayerUpdate;

/**
 * Base class for selective effect layers.
 *
 * Provides buffer accessors (EmissiveBuffer, EffectIds Buffer) and
 * effect slot management for the buffer-based SE pipeline.
 */
export abstract class SelectiveEffectLayer<
  Config extends SelectiveEffectLayerConfig = SelectiveEffectLayerConfig,
  UpdateConfig extends SelectiveEffectLayerUpdate = SelectiveEffectLayerUpdate,
> extends EffectLayerDeclaration<Config, UpdateConfig> {
  protected config: Config;
  protected abstract getEffectKey(): string;
  protected abstract getResolutionScale(): number;
  protected abstract getDebugViews(): boolean;

  constructor(view: ViewContext, config: Config) {
    super(view, config);
    this.config = config;
  }

  public get viewContext(): ViewContext {
    return this.view;
  }

  public get layerConfig(): Config {
    return this.config;
  }

  onCreate(): void {
    // Register effect key (needed for link() to resolve effectId → effectKey)
    this.view.selectiveEffectRegistry?.registerEffectKey(
      this.id,
      this.getEffectKey(),
    );

    // Register effect slot for EffectIds Buffer
    const mrtLayer = this.findLayer<MRTPassEffectLayer>("mrt");
    mrtLayer?.effectSlotRegistry.register(this.id);

    super.onCreate();
  }

  // --- Buffer accessors for subclass passes ---

  public getEmissiveBuffer(): Texture | null {
    const mrtLayer = this.findLayer<MRTPassEffectLayer>("mrt");
    return mrtLayer?.emissiveBuffer ?? null;
  }

  public getEffectIdsBuffer(): Texture | null {
    const mrtLayer = this.findLayer<MRTPassEffectLayer>("mrt");
    return mrtLayer?.effectIdsBuffer ?? null;
  }

  public getEffectSlot(): number {
    const mrtLayer = this.findLayer<MRTPassEffectLayer>("mrt");
    return mrtLayer?.effectSlotRegistry.getSlot(this.id) ?? -1;
  }

  onDestroy(): void {
    // Unregister effect slot
    const mrtLayer = this.findLayer<MRTPassEffectLayer>("mrt");
    mrtLayer?.effectSlotRegistry.unregister(this.id);

    super.onDestroy();
  }
}
