import {
  ReturnedConstructedTerrainMeshLike,
  TransferableMartiniLike,
  TransferableRasterDEMDataLike,
  TransferableTileLike,
} from "@navara/core";
import type { Promise } from "@navara/worker";

import { queueTask } from "./queueTask";

export function constructTerrainMesh(
  bytes: Uint8Array,
  tileLike: TransferableTileLike,
  rasterDEMDataLike: TransferableRasterDEMDataLike,
  martiniLike: TransferableMartiniLike,
): Promise<{
  result: ReturnedConstructedTerrainMeshLike;
}> {
  return queueTask(
    "constructTerrainMesh",
    [bytes, tileLike, rasterDEMDataLike, martiniLike],
    { transfer: [bytes.buffer, martiniLike.coords.buffer] },
  );
}
