import type { UpsamplableTerrainGeometry } from "@navara/engine";

export class UpsamplableTerrainGeometryLike implements UpsamplableTerrainGeometry {
  uvs: Float32Array;
  indices: Uint32Array;
  heights: Float32Array;

  constructor(uvs: Float32Array, indices: Uint32Array, heights: Float32Array) {
    this.uvs = uvs;
    this.indices = indices;
    this.heights = heights;
  }

  free(): void {}
}
