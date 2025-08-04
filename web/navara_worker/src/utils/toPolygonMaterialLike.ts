import { type PolygonMaterialLike } from "@navara/core";
import { PolygonMaterial } from "@navara/engine-worker";

export function toPolygonMaterialLike(like: PolygonMaterialLike) {
  return new PolygonMaterial(
    like.show,
    like.cast_shadow,
    like.receive_shadow,
    like.color,
    like.clamp_to_ground,
    like.use_ground_normals,
    like.height,
    like.extruded_height,
    like.wireframe,
    like.__internal__,
  );
}
