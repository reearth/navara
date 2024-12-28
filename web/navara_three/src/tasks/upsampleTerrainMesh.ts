import {
  ReturnedConstructedTerrainMeshLike,
  TransferableRasterDEMDataLike,
  TransferableTileLike,
  UpsamplableTerrainGeometryLike,
} from "@navara/core";
import type { Promise } from "workerpool";

import { queueTask } from "./queueTask";

export function upsampleTerrainMesh(
  tileLike: TransferableTileLike,
  parentTileLike: TransferableTileLike,
  rasterDEMDataLike: TransferableRasterDEMDataLike,
  upsamplableGeometryLike: UpsamplableTerrainGeometryLike,
): Promise<ReturnedConstructedTerrainMeshLike> {
  return queueTask(
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
}
