import { ExtentRadianF32 } from "@navara/engine-worker";

export function toExtentRadianF32Like(like: ExtentRadianF32) {
  return new ExtentRadianF32(like.west, like.south, like.east, like.north);
}
