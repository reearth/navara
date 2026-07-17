import type { ExtentRadianF32Like } from "@navaramap/core";
import { ExtentRadianF32 } from "@navaramap/engine-worker";

export function toExtentRadianF32Like(like: ExtentRadianF32Like) {
  return new ExtentRadianF32(like.west, like.south, like.east, like.north);
}
