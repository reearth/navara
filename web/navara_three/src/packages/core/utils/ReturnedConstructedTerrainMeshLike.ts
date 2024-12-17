import type { Geometry, ReturnedConstructedTerrainMesh } from "@navara/engine";

import { GeometryLike } from "./GeometryLike";

export class ReturnedConstructedTerrainMeshLike
  implements ReturnedConstructedTerrainMesh
{
  geometry: GeometryLike;
  heights: Float32Array;
  max_height: number;
  min_height: number;

  constructor(t: ReturnedConstructedTerrainMesh) {
    this.geometry = new GeometryLike(t.transferGeometry());
    this.heights = t.transferHeights();
    this.max_height = t.max_height;
    this.min_height = t.min_height;
  }

  transferGeometry(): Geometry {
    throw new Error();
  }
  transferHeights(): Float32Array {
    throw new Error();
  }

  free(): void {}
}
