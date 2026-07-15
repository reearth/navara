import {
  ReturnedConstructedTerrainMeshLike,
  TransferableTileLike,
  UpsamplableTerrainGeometryLike,
} from "@navara/core";
import type { Promise } from "@navara/worker";

import { queueTask } from "./queueTask";

export function upsampleQuantizedMeshTerrainMesh(
  tileLike: TransferableTileLike,
  parentTileLike: TransferableTileLike,
  upsamplableGeometryLike: UpsamplableTerrainGeometryLike,
  skirt: boolean,
  skirtExaggeration: number,
  geographic: boolean,
  tms: boolean,
): Promise<ReturnedConstructedTerrainMeshLike> {
  return queueTask(
    "upsampleQuantizedMeshTerrainMesh",
    [
      tileLike,
      parentTileLike,
      upsamplableGeometryLike,
      skirt,
      skirtExaggeration,
      geographic,
      tms,
    ],
    {
      transfer: [
        upsamplableGeometryLike.uvs.buffer,
        upsamplableGeometryLike.heights.buffer,
        upsamplableGeometryLike.indices.buffer,
        ...(upsamplableGeometryLike.normals
          ? [upsamplableGeometryLike.normals.buffer]
          : []),
        ...(upsamplableGeometryLike.watermask
          ? [upsamplableGeometryLike.watermask.buffer]
          : []),
      ],
    },
  );
}
