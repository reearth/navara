import {
  ReturnedConstructedTerrainMeshLike,
  TransferableTileLike,
} from "@navara/core";
import type { Promise } from "@navara/worker";

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
