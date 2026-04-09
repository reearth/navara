import { OrthographicCamera, PlaneGeometry, type Texture } from "three";

import {
  EffectLayerDeclaration,
  type EffectLayerConfig,
  type EffectLayerUpdate,
} from "../../core/EffectLayerDeclaration";
import type { ViewContext } from "../../core/ViewContext";

import type { MRTPassEffectLayer } from "./MRTPassEffectLayer";

// Base configuration for selective effect layers
export type SelectiveEffectLayerConfig = {
  selectiveEffect: true;
} & EffectLayerConfig;

export type SelectiveEffectLayerUpdate = EffectLayerUpdate;

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
export abstract class SelectiveEffectLayer<
  Config extends SelectiveEffectLayerConfig = SelectiveEffectLayerConfig,
  UpdateConfig extends SelectiveEffectLayerUpdate = SelectiveEffectLayerUpdate,
> extends EffectLayerDeclaration<Config, UpdateConfig> {
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
