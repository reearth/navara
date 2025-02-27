import { isNotNullish, ConstructedPolygonGeometryLike } from "@navara/core";
import type { ConstructedPolygonGeometry } from "@navara/engine-worker";

export function transferConstructedPolygonGeometry(
  r: ConstructedPolygonGeometry,
) {
  const like = new ConstructedPolygonGeometryLike(r);
  return {
    result: like,
    transfers: [
      like.batch_id?.buffer,
      like.normal?.buffer,
      like.position?.buffer,
      like.scale_normal_and_cap?.buffer,
      like.indices.buffer,
    ].filter(isNotNullish),
  };
}
