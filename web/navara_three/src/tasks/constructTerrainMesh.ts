import {
  ReturnedConstructedTerrainMeshLike,
  TransferableRasterDEMDataLike,
  TransferableTileLike,
} from "@navaramap/core";
import type { Promise } from "@navaramap/worker";

import { queueTask } from "./queueTask";

export function constructTerrainMesh(
  bytes: Uint8Array,
  tileLike: TransferableTileLike,
  rasterDEMDataLike: TransferableRasterDEMDataLike,
  size: number,
  skirt: boolean,
  skirtExaggeration: number,
): Promise<{
  result: ReturnedConstructedTerrainMeshLike;
}> {
  return queueTask(
    "constructTerrainMesh",
    [bytes, tileLike, rasterDEMDataLike, size, skirt, skirtExaggeration],
    { transfer: [bytes.buffer] },
  );
}
