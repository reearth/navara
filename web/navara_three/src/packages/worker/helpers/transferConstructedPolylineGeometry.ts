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
      like.start.buffer,
      like.start_normals.buffer,
      like.forward_offset.buffer,
      like.end_normal_and_texture_coordinate_normalization_x.buffer,
      like.right_normal_and_texture_coordinate_normalization_y.buffer,
      like.batch_id?.buffer,
      like.indices.buffer,
    ].filter(isNotNullish),
  };
}
