import { ExtentRadianF32Like } from "@navaramap/core";
import type { ParsedMvtTileResultLike, Promise } from "@navaramap/worker";

import { queueTask } from "./queueTask";

export function parseMvtTile(
  bytes: Uint8Array,
  x: number,
  y: number,
  z: number,
  tileExtent: ExtentRadianF32Like | undefined,
  compression: number,
  configsJson: string,
): Promise<ParsedMvtTileResultLike> {
  return queueTask(
    "parseMvtTile",
    [bytes, x, y, z, tileExtent, compression, configsJson],
    {
      transfer: [bytes.buffer],
    },
  );
}
