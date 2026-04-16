import { ConstructedPolylineGeometryLike, isNotNullish } from "@navara/core";
import type { ConstructedPolylineGeometry } from "@navara/engine-worker";

export function transferConstructedPolylineGeometry(
  r: ConstructedPolylineGeometry,
) {
  const like = new ConstructedPolylineGeometryLike(r);
  return {
    result: like,
    transfers: [
      like.position.buffer,
      like.position_high?.buffer,
      like.position_low?.buffer,
      like.start?.buffer,
      like.start_high?.buffer,
      like.start_low?.buffer,
      like.end_high?.buffer,
      like.end_low?.buffer,
      like.start_normals?.buffer,
      like.forward_offset?.buffer,
      like.end_normal_and_texture_coordinate_normalization_x?.buffer,
      like.right_normal_and_texture_coordinate_normalization_y.buffer,
      like.batch_id?.buffer,
      like.batch_index?.buffer,
      like.indices.buffer,
    ].filter(isNotNullish),
  };
}
