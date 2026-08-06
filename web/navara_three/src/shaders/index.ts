import { packing } from "@takram/three-geospatial/shaders";
import { ShaderChunk } from "three";

export * from "@takram/three-geospatial/shaders";

/**
 * Codec for the normal buffer's RG channels, which are **octahedral**, not a
 * plain `xy * 2 - 1`: decode with `unpackVec2ToNormal`. Prepend to shaders
 * that cannot use `#include` resolution (postprocessing effect fragments).
 */
export const NORMAL_PACKING_SHADER: string = packing;

/**
 * Three's `packing` chunk, for the MRT pass's packed depth buffers – check
 * `depthBufferPacking` / `globeDepthBufferPacking` for the packing in use.
 */
export const DEPTH_PACKING_SHADER: string = ShaderChunk.packing;
