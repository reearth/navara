import type { UpsamplableTerrainGeometry } from "@navara/engine";

export class UpsamplableTerrainGeometryLike
  implements UpsamplableTerrainGeometry
{
  uvs: Float32Array<ArrayBufferLike>;
  indices: Uint32Array<ArrayBufferLike>;
  heights: Float32Array<ArrayBufferLike>;

  constructor(t: UpsamplableTerrainGeometry) {
    this.uvs = t.uvs;
    this.indices = t.indices;
    this.heights = t.heights;
  }

  free(): void {}
}
