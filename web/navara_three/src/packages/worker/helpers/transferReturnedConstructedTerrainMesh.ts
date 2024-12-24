import { ReturnedConstructedTerrainMeshLike } from "@navara/core";
import type { ReturnedConstructedTerrainMesh } from "@navara/engine-worker";

export function transferReturnedConstructedTerrainMesh(
  r: ReturnedConstructedTerrainMesh,
) {
  const like = new ReturnedConstructedTerrainMeshLike(r);
  return {
    result: like,
    transfers: [
      like.vertices.buffer,
      like.uvs.buffer,
      like.indices.buffer,
      like.heights.buffer,
    ],
  };
}
