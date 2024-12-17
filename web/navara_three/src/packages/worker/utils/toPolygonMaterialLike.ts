import { type PolygonMaterialLike } from "@navara/core";
import { PolygonMaterial } from "@navara/engine-worker";

export function toPolygonMaterialLike(like: PolygonMaterialLike) {
  return new PolygonMaterial(
    like.show,
    like.color,
    like.clamp_to_ground,
    like.height,
    like.extruded_height,
    like.wireframe,
    like.__internal__,
  );
}
