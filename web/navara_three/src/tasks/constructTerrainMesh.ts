import {
  TransferableMartiniLike,
  TransferableRasterDEMDataLike,
  TransferableTileLike,
} from "@navara/core";
import type { ReturnedConstructedTerrainMesh } from "@navara/engine";

import { queueTask } from "./queueTask";

export async function constructTerrainMesh(
  bytes: Uint8Array,
  tileLike: TransferableTileLike,
  rasterDEMDataLike: TransferableRasterDEMDataLike,
  martiniLike: TransferableMartiniLike,
): Promise<{
  result: ReturnedConstructedTerrainMesh;
  martini: TransferableMartiniLike;
}> {
  const result = await queueTask(
    "constructTerrainMesh",
    [bytes, tileLike, rasterDEMDataLike, martiniLike],
    { transfer: [bytes.buffer, martiniLike.coords.buffer] },
  );
  return result;
}
