import {
  ReturnedConstructedTerrainMeshLike,
  TransferableRasterDEMDataLike,
  TransferableTileLike,
  UpsamplableTerrainGeometryLike,
} from "@navara/core";

import { queueTask } from "./queueTask";

export async function upsampleTerrainMesh(
  tileLike: TransferableTileLike,
  parentTileLike: TransferableTileLike,
  rasterDEMDataLike: TransferableRasterDEMDataLike,
  upsamplableGeometryLike: UpsamplableTerrainGeometryLike,
): Promise<ReturnedConstructedTerrainMeshLike> {
  const result = await queueTask(
    "upsampleTerrainMesh",
    [tileLike, parentTileLike, rasterDEMDataLike, upsamplableGeometryLike],
    {
      transfer: [
        upsamplableGeometryLike.uvs.buffer,
        upsamplableGeometryLike.heights.buffer,
        upsamplableGeometryLike.indices.buffer,
      ],
    },
  );
  return result;
}
