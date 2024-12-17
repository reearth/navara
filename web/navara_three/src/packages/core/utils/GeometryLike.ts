import type { Geometry } from "@navara/engine";

export class GeometryLike implements Geometry {
  indices: Uint32Array;
  uvs: Float32Array;
  vertices: Float32Array;

  constructor(t: Geometry) {
    this.vertices = t.transferVertices();
    this.uvs = t.transferUvs();
    this.indices = t.transferIndices();
  }

  transferVertices(): Float32Array {
    throw new Error();
  }
  transferUvs(): Float32Array {
    throw new Error();
  }
  transferIndices(): Uint32Array {
    throw new Error();
  }

  free(): void {}
}
