import {
  TransferableMartiniLike,
  TransferableRasterDEMDataLike,
  TransferableTileLike,
} from "@navara/core";
import type {
  ReturnedConstructedTerrainMesh,
  TransferableRasterDEMData,
  TransferableTile,
} from "@navara/engine";

import { queueTask } from "./queueTask";

export async function constructTerrainMesh(
  bytes: Uint8Array,
  tile: TransferableTile,
  rasterDEMData: TransferableRasterDEMData,
  martiniLike: TransferableMartiniLike,
): Promise<ReturnedConstructedTerrainMesh> {
  const tileLike = new TransferableTileLike(tile);
  const rasterDEMDataLike = new TransferableRasterDEMDataLike(rasterDEMData);
  const result = await queueTask(
    "constructTerrainMesh",
    [bytes, tileLike, rasterDEMDataLike, martiniLike],
    { transfer: [bytes.buffer] },
  );
  return result;
}
