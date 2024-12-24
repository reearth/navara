import {
  ReturnedConstructedTerrainMeshLike,
  TransferableMartiniLike,
  TransferableRasterDEMDataLike,
  TransferableTileLike,
} from "@navara/core";

import { queueTask } from "./queueTask";

export async function constructTerrainMesh(
  bytes: Uint8Array,
  tileLike: TransferableTileLike,
  rasterDEMDataLike: TransferableRasterDEMDataLike,
  martiniLike: TransferableMartiniLike,
): Promise<{
  result: ReturnedConstructedTerrainMeshLike;
}> {
  const result = await queueTask(
    "constructTerrainMesh",
    [bytes, tileLike, rasterDEMDataLike, martiniLike],
    { transfer: [bytes.buffer, martiniLike.coords.buffer] },
  );
  return result;
}
