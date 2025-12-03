import { type PolygonMaterialLike } from "@navara/core";
import { PolygonMaterial } from "@navara/engine-worker";

export function toPolygonMaterialLike(like: PolygonMaterialLike) {
  return new PolygonMaterial(
    like.show,
    like.castShadow,
    like.receiveShadow,
    like.color,
    like.clampToGround,
    like.useGroundNormals,
    like.height,
    like.extrudedHeight,
    like.wireframe,
    like.perPositionHeight,
    like.__internal__,
  );
}
