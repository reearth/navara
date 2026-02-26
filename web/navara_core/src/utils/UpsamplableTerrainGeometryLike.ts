import type { UpsamplableTerrainGeometry } from "@navara/engine";

import type { RemoveFreeRecursively } from "../types";

export class UpsamplableTerrainGeometryLike implements RemoveFreeRecursively<UpsamplableTerrainGeometry> {
  uvs: Float32Array;
  indices: Uint32Array;
  heights: Float32Array;

  constructor(uvs: Float32Array, indices: Uint32Array, heights: Float32Array) {
    this.uvs = uvs;
    this.indices = indices;
    this.heights = heights;
  }
}
