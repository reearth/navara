import { PolylineMaterialLike } from "@navara/core";
import { PolylineMaterial } from "@navara/engine-worker";

export function toPolylineMaterialLike(like: PolylineMaterialLike) {
  return new PolylineMaterial(
    like.show,
    like.castShadow,
    like.receiveShadow,
    like.color,
    like.clampToGround,
    like.useGroundNormals,
    like.height,
    like.width,
    like.maxWidth,
    like.__internal__,
  );
}
