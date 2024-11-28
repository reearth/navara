import type { ReturnedConstructedTerrainMesh } from "@navara/engine";

import { GeometryLike } from "./GeometryLike";

export class ReturnedConstructedTerrainMeshLike
  implements ReturnedConstructedTerrainMesh
{
  geometry: GeometryLike;
  heights: Float32Array;
  max_height: number;
  min_height: number;

  constructor(t: ReturnedConstructedTerrainMesh) {
    this.geometry = new GeometryLike(t.geometry);
    this.heights = t.heights;
    this.max_height = t.max_height;
    this.min_height = t.min_height;
  }

  free(): void {}
}
