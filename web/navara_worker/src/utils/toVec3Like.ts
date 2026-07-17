import { Vec3Like } from "@navaramap/core";
import { Vec3 } from "@navaramap/engine-worker";

export function toVec3Like(like: Vec3) {
  return new Vec3Like(like);
}
