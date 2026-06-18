import type { CompositeLayerEnhancer } from "../types";

import { createWatermaskMutates } from "./mutates";
import { watermaskGlobalUniformDecls, watermaskPostLoop } from "./shader";

/**
 * Quantized-mesh watermask: a slot-independent single-channel texture sampled
 * once after the slot loop. Contributes a global sampler, not a per-slot
 * uniform, so a watermask-only tile (no raster/vector layers) still bakes water
 * into the atlas.
 */
export function createTileWatermaskEnhancer(
  active: boolean,
): CompositeLayerEnhancer | undefined {
  if (!active) return undefined;
  const mutates = createWatermaskMutates();
  return {
    globalUniformDecls: watermaskGlobalUniformDecls,
    postLoop: watermaskPostLoop,
    attachUniforms: mutates.attachUniforms,
    bindGlobal: mutates.bindGlobal,
  };
}
