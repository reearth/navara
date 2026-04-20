import { OrthographicCamera, PlaneGeometry, type Texture } from "three";

import {
  EffectDesc,
  type EffectConfig,
  type EffectUpdate,
} from "../../core/EffectDesc";
import type { ViewContext } from "../../core/ViewContext";
import type ThreeView from "../../index";

import type { MRTPassEffectDesc } from "./MRTPassEffectDesc";

// Base configuration for selective effect descriptors
export type SelectiveEffectConfig = {
  selectiveEffect?: true;
} & EffectConfig;

export type SelectiveEffectUpdate = EffectUpdate;

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
 * Base class for buffer-based selective effect descriptors (Bloom, Outline, etc.).
 *
 * Manages effect key registration, EffectIds Buffer slot allocation, and
 * provides MRT buffer accessors for subclass passes.
 *
 * Subclasses implement {@link createPass}.
 */
export abstract class SelectiveEffectDesc<
  Config extends SelectiveEffectConfig = SelectiveEffectConfig,
  UpdateConfig extends SelectiveEffectUpdate = SelectiveEffectUpdate,
> extends EffectDesc<Config, UpdateConfig> {
  protected config: Config;

  constructor(view: ThreeView, ctx: ViewContext, config: Config) {
    super(view, ctx, config);
    this.config = config;
  }

  // ---------------------------------------------------------------------------
  // Public API for Pass classes
  // ---------------------------------------------------------------------------

  /** ViewContext for accessing scenes, renderer, registry, etc. */
  public get viewContext(): ViewContext {
    return this.ctx;
  }

  /** Layer configuration (typed per subclass). */
  public get layerConfig(): Config {
    return this.config;
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  onCreate(): void {
    const registry = this.ctx.selectiveEffectRegistry;
    if (!registry) {
      throw new Error(
        "SelectiveEffectRegistry not initialized. Ensure MRTPassEffectDesc is added before selective effect descriptors.",
      );
    }

    // Allocate a slot bit in the EffectIds Buffer
    registry.registerSlot(this.id);

    super.onCreate();
  }

  onDestroy(): void {
    const registry = this.ctx.selectiveEffectRegistry;

    // Release slot bit in the EffectIds Buffer
    registry?.unregisterSlot(this.id);

    super.onDestroy();
  }

  // ---------------------------------------------------------------------------
  // Buffer accessors — used by subclass passes to read MRT data
  // ---------------------------------------------------------------------------

  /** Emissive RGB buffer (MRT attachment[3]). */
  public getEmissiveBuffer(): Texture | null {
    const mrtLayer = this.find<MRTPassEffectDesc>("mrt");
    return mrtLayer?.emissiveBuffer ?? null;
  }

  /** EffectIds bitmask buffer (MRT attachment[2]). NearestFilter, discrete data. */
  public getEffectIdsBuffer(): Texture | null {
    const mrtLayer = this.find<MRTPassEffectDesc>("mrt");
    return mrtLayer?.effectIdsBuffer ?? null;
  }

  /** Slot bit index for this effect instance in the EffectIds Buffer. -1 if unregistered. */
  public getEffectSlot(): number {
    return this.ctx.selectiveEffectRegistry?.getSlot(this.id) ?? -1;
  }
}
