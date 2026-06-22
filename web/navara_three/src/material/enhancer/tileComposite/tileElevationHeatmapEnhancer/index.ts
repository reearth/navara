import type { CompositeLayerEnhancer } from "../types";

import { createElevationMutates } from "./mutates";
import {
  elevationIncludes,
  elevationSampleProducer,
  elevationSlotUniformDecls,
} from "./shader";

/**
 * Elevation heatmap layers decode a DEM raster to a height and colorize it
 * through the shared 1-D colormap. The decoder uniforms and colormap sampler
 * are slot-independent; the decoder chunk is inlined via `includes`.
 */
export function createTileElevationHeatmapEnhancer(
  active: boolean,
): CompositeLayerEnhancer | undefined {
  if (!active) return undefined;
  const mutates = createElevationMutates();
  return {
    defines: { USE_ELEVATION_HEATMAP: 1 },
    slotUniformDecls: elevationSlotUniformDecls,
    includes: elevationIncludes,
    sampleProducer: elevationSampleProducer,
    attachUniforms: mutates.attachUniforms,
    bindSlot: mutates.bindSlot,
    bindGlobal: mutates.bindGlobal,
  };
}
