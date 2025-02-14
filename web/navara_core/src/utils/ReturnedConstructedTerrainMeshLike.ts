import type { ReturnedConstructedTerrainMesh } from "@navara/engine";

export class ReturnedConstructedTerrainMeshLike
  implements ReturnedConstructedTerrainMesh
{
  vertices: Float32Array;
  uvs: Float32Array;
  indices: Uint32Array;
  heights: Float32Array;
  max_height: number;
  min_height: number;

  constructor(t: ReturnedConstructedTerrainMesh) {
    this.vertices = t.transferVertices().slice();
    this.uvs = t.transferUvs().slice();
    this.indices = t.transferIndices().slice();
    this.heights = t.transferHeights().slice();
    this.max_height = t.max_height;
    this.min_height = t.min_height;
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
  transferHeights(): Float32Array {
    throw new Error();
  }
  drop(): void {}

  free(): void {}
}
