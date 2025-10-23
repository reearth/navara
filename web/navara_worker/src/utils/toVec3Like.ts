import { Vec3Like } from "@navara/core";
import { Vec3 } from "@navara/engine-worker";

export function toVec3Like(like: Vec3) {
  return new Vec3Like(like);
}
