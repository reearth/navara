import { ReturnedConstructedTerrainMeshLike } from "@navara/core";
import type { ReturnedConstructedTerrainMesh } from "@navara/engine-worker";

import { transfer } from "../worker";

export function transferReturnedConstructedTerrainMesh(
  r: ReturnedConstructedTerrainMesh,
) {
  const like = new ReturnedConstructedTerrainMeshLike(r);
  return transfer(like, [
    like.geometry.vertices.buffer,
    like.geometry.uvs.buffer,
    like.geometry.indices.buffer,
    like.heights.buffer,
  ]);
}
