import type { UpsamplableTerrainGeometry } from "@navara/engine";

export class UpsamplableTerrainGeometryLike
  implements UpsamplableTerrainGeometry
{
  uvs: Float32Array;
  indices: Uint32Array;
  heights: Float32Array;

  constructor(t: UpsamplableTerrainGeometry) {
    this.uvs = t.uvs;
    this.indices = t.indices;
    this.heights = t.heights;
  }

  free(): void {}
}
