import type { Geometry } from "@navara/engine";

export class GeometryLike implements Geometry {
  indices: Uint32Array;
  uvs: Float32Array;
  vertices: Float32Array;

  constructor(t: Geometry) {
    this.vertices = t.vertices;
    this.uvs = t.uvs;
    this.indices = t.indices;
  }

  free(): void {}
}
