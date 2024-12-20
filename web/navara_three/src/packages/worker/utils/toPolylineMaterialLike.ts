import { PolylineMaterialLike } from "@navara/core";
import { PolylineMaterial } from "@navara/engine-worker";

export function toPolylineMaterialLike(like: PolylineMaterialLike) {
  return new PolylineMaterial(
    like.show,
    like.color,
    like.clamp_to_ground,
    like.height,
    like.width,
    like.__internal__,
  );
}
