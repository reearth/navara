import {
  ReturnedConstructedTerrainMeshLike,
  TransferableRasterDEMDataLike,
  TransferableTileLike,
  UpsamplableTerrainGeometryLike,
} from "@navara/core";
import type { Promise } from "@navara/worker";

import { queueTask } from "./queueTask";

export function upsampleTerrainMesh(
  tileLike: TransferableTileLike,
  parentTileLike: TransferableTileLike,
  rasterDEMDataLike: TransferableRasterDEMDataLike,
  upsamplableGeometryLike: UpsamplableTerrainGeometryLike,
  skirt: boolean,
  skirtExaggeration: number,
): Promise<ReturnedConstructedTerrainMeshLike> {
  return queueTask(
    "upsampleTerrainMesh",
    [
      tileLike,
      parentTileLike,
      rasterDEMDataLike,
      upsamplableGeometryLike,
      skirt,
      skirtExaggeration,
    ],
    {
      transfer: [
        upsamplableGeometryLike.uvs.buffer,
        upsamplableGeometryLike.heights.buffer,
        upsamplableGeometryLike.indices.buffer,
      ],
    },
  );
}
