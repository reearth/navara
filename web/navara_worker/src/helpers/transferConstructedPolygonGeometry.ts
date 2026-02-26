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
      like.batch_index?.buffer,
      like.normal?.buffer,
      like.position_3d_high?.buffer,
      like.position_3d_low?.buffer,
      like.position?.buffer,
      like.scale_normal_and_cap?.buffer,
      like.indices.buffer,
      like.outline_position?.buffer,
      like.outline_scale_normal_and_cap?.buffer,
      like.outline_skip_indices?.buffer,
      like.outline_batch_index?.buffer,
    ].filter(isNotNullish),
  };
}
