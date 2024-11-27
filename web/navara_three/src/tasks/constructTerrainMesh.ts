import {
  TransferableMartiniLike,
  TransferableRasterDEMDataLike,
  TransferableTileLike,
} from "@navara/core";
import type {
  ReturnedConstructedTerrainMesh,
  TransferableMartini,
  TransferableRasterDEMData,
  TransferableTile,
} from "@navara/engine";

import { queueTask } from "./queueTask";

export async function constructTerrainMesh(
  bytes: Uint8Array,
  tile: TransferableTile,
  rasterDEMData: TransferableRasterDEMData,
  martini: TransferableMartini,
): Promise<ReturnedConstructedTerrainMesh> {
  const tileLike = new TransferableTileLike(tile);
  const martiniLike = new TransferableMartiniLike(martini);
  const rasterDEMDataLike = new TransferableRasterDEMDataLike(rasterDEMData);
  const result = await queueTask(
    "constructTerrainMesh",
    [bytes, tileLike, rasterDEMDataLike, martiniLike],
    { transfer: [bytes.buffer] },
  );
  return result;
}
