import { PolylineMaterialLike } from "@navaramap/core";
import { PolylineMaterial } from "@navaramap/engine-worker";

export function toPolylineMaterialLike(like: PolylineMaterialLike) {
  return new PolylineMaterial(
    like.show,
    like.castShadow,
    like.receiveShadow,
    like.color,
    like.clampToGround,
    like.tiled,
    like.height,
    like.width,
    like.maxWidth,
    like.__internal__,
  );
}
