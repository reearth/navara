import { ExtentRadianF32Like } from "@navara/core";

import { queueTask } from "./queueTask";

export function parseMvtTile(
  bytes: Uint8Array,
  x: number,
  y: number,
  z: number,
  tileExtent: ExtentRadianF32Like | undefined,
  compression: number,
  configsJson: string,
) {
  return queueTask(
    "parseMvtTile",
    [bytes, x, y, z, tileExtent, compression, configsJson],
    {
      transfer: [bytes.buffer],
    },
  );
}
