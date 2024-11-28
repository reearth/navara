import {
  TransferableRasterDEMDataLike,
  TransferableTileLike,
  UpsamplableTerrainGeometryLike,
} from "@navara/core";
import type {
  ReturnedConstructedTerrainMesh,
  TransferableRasterDEMData,
  TransferableTile,
  UpsamplableTerrainGeometry,
} from "@navara/engine";

import { queueTask } from "./queueTask";

export async function upsampleTerrainMesh(
  tile: TransferableTile,
  parentTile: TransferableTile,
  rasterDEMData: TransferableRasterDEMData,
  upsamplableGeometry: UpsamplableTerrainGeometry,
): Promise<ReturnedConstructedTerrainMesh> {
  const tileLike = new TransferableTileLike(tile);
  const parentTileLike = new TransferableTileLike(parentTile);
  const rasterDEMDataLike = new TransferableRasterDEMDataLike(rasterDEMData);
  const upsamplableGeometryLike = new UpsamplableTerrainGeometryLike(
    upsamplableGeometry,
  );
  const result = await queueTask(
    "upsampleTerrainMesh",
    [tileLike, parentTileLike, rasterDEMDataLike, upsamplableGeometryLike],
    {
      transfer: [
        upsamplableGeometry.uvs.buffer,
        upsamplableGeometry.heights.buffer,
        upsamplableGeometry.indices.buffer,
      ],
    },
  );
  return result;
}
