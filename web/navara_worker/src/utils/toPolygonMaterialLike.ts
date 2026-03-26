import { type PolygonMaterialLike } from "@navara/core";
import { PolygonMaterial } from "@navara/engine-worker";

export function toPolygonMaterialLike(like: PolygonMaterialLike) {
  const mat = new PolygonMaterial(
    like.show,
    like.castShadow,
    like.receiveShadow,
    like.color,
    like.clampToGround,
    like.tiled,
    like.height,
    like.extrudedHeight,
    like.wireframe,
    like.outline,
    like.perPositionHeight,
    like.__internal__,
  );
  return mat;
}
