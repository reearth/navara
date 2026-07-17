import {
  ReturnedConstructedTerrainMeshLike,
  TransferableTileLike,
} from "@navaramap/core";
import type { Promise } from "@navaramap/worker";

import { queueTask } from "./queueTask";

export function constructQuantizedMeshTerrainMesh(
  bytes: Uint8Array,
  tileLike: TransferableTileLike,
  skirt: boolean,
  skirtExaggeration: number,
  geographic: boolean,
  tms: boolean,
): Promise<{
  result: ReturnedConstructedTerrainMeshLike;
}> {
  return queueTask(
    "constructQuantizedMeshTerrainMesh",
    [bytes, tileLike, skirt, skirtExaggeration, geographic, tms],
    { transfer: [bytes.buffer] },
  );
}
