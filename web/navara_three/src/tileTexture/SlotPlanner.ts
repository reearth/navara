import type { CompositeLayer, CompositeLayerRegion } from "./types";

/**
 * Round `n` up to the next power of two, clamped to `[0, max]`. Bounds the
 * number of generated shader variants to log₂(max)+1 so churn in the active
 * count doesn't trigger a shader-compile per tile per frame. Compiles are
 * tens of ms each — variant explosion is the worst-case stutter source here.
 *
 * `Math.clz32(n - 1)` gives the leading-zero count of (n-1) interpreted as a
 * uint32. `1 << (32 - clz32(n - 1))` is then the smallest power of two ≥ n.
 * For n=1, clz32(0)=32 so the shift is 1<<0=1 — the n=1 edge falls out of the
 * same formula. Returns 0 when n is 0 so an empty bucket contributes no slots.
 */
export function quantizeSlotCount(n: number, max: number): number {
  if (n <= 0) return 0;
  return Math.min(1 << (32 - Math.clz32(n - 1)), max);
}

/** One compact slot, mapped to its absolute slot and (optionally) a layer. */
export type SlotBinding = {
  /** Compact index `[0, rasterCount + vectorCount)`. */
  compactSlot: number;
  /** Absolute slot index into the TileMesh main-shader per-slot uniforms. */
  absSlot: number;
  region: CompositeLayerRegion;
  /**
   * The active layer occupying `absSlot`, or undefined for an inactive prefix
   * slot. The compact space is a prefix per bucket (so `winningSlot = absSlot`
   * stays addressable), hence a quantized bucket can hold gaps.
   */
  layer: CompositeLayer | undefined;
};

/**
 * The compact slot layout for one tile's composite pass. `rasterCount` and
 * `vectorCount` are power-of-two-quantized high-water marks; `slots` is the
 * concrete compact→absolute mapping the enhancers bind against.
 */
export type SlotPlan = {
  rasterCount: number;
  vectorCount: number;
  /** `texturizedSceneIndexFrom` — boundary between raster and vector regions. */
  boundary: number;
  slots: SlotBinding[];
};

/**
 * Flatten active layers into the compact slot layout. Raster-region layers
 * occupy compact slots `[0, rasterCount)` (absSlot = compact); vector-region
 * layers occupy `[rasterCount, total)` mapping to `boundary + offset`. Each
 * bucket's count is the quantized high-water mark of its active absolute slots.
 *
 * Callers pass only active layers (shown AND textured), so each bucket's
 * high-water mark is simply its highest active absolute slot.
 *
 * Stitching seam: a layer maps to exactly one slot today. To stitch multiple
 * source textures onto one logical layer later, expand a layer into several
 * consecutive SlotBindings here — the rest of the pipeline already binds per
 * SlotBinding.
 */
export function planSlots(
  layers: readonly CompositeLayer[],
  boundary: number,
  maxTextures: number,
): SlotPlan {
  let rasterHigh = 0;
  let vectorHigh = 0;
  const byAbsSlot = new Map<number, CompositeLayer>();
  for (const layer of layers) {
    byAbsSlot.set(layer.absSlot, layer);
    if (layer.region === "raster") {
      rasterHigh = Math.max(rasterHigh, layer.absSlot + 1);
    } else {
      vectorHigh = Math.max(vectorHigh, layer.absSlot - boundary + 1);
    }
  }

  const rasterCount = quantizeSlotCount(rasterHigh, boundary);
  const vectorCount = quantizeSlotCount(vectorHigh, maxTextures - boundary);

  const slots: SlotBinding[] = [];
  for (
    let compactSlot = 0;
    compactSlot < rasterCount + vectorCount;
    compactSlot++
  ) {
    const region: CompositeLayerRegion =
      compactSlot < rasterCount ? "raster" : "vector";
    const absSlot =
      compactSlot < rasterCount
        ? compactSlot
        : boundary + (compactSlot - rasterCount);
    slots.push({
      compactSlot,
      absSlot,
      region,
      layer: byAbsSlot.get(absSlot),
    });
  }

  return { rasterCount, vectorCount, boundary, slots };
}
