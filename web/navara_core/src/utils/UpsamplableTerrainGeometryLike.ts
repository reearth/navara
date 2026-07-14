import type { UpsamplableTerrainGeometry } from "@navara/engine";

import type { RemoveFreeRecursively } from "../types";

export class UpsamplableTerrainGeometryLike implements RemoveFreeRecursively<UpsamplableTerrainGeometry> {
  uvs: Float32Array;
  indices: Uint32Array;
  heights: Float32Array;
  normals: Float32Array | undefined;
  /** Parent quantized-mesh watermask (1 byte uniform or 65536 byte 256x256 grid). */
  watermask: Uint8Array | undefined;

  constructor(
    uvs: Float32Array,
    indices: Uint32Array,
    heights: Float32Array,
    normals?: Float32Array,
    watermask?: Uint8Array,
  ) {
    this.uvs = uvs;
    this.indices = indices;
    this.heights = heights;
    this.normals = normals;
    this.watermask = watermask;
  }
}
