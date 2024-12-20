import { ConstructedPolylineGeometryLike, isNotNullish } from "@navara/core";
import type { ConstructedPolylineGeometry } from "@navara/engine-worker";

export function transferConstructedPolylineGeometry(
  r: ConstructedPolylineGeometry,
) {
  const like = new ConstructedPolylineGeometryLike(r);
  return {
    result: like,
    transfers: [
      like.geometry.attributes.position.data.buffer,
      like.geometry.attributes.start.data.buffer,
      like.geometry.attributes.start_normals.data.buffer,
      like.geometry.attributes.forward_offset.data.buffer,
      like.geometry.attributes.end_normal_and_texture_coordinate_normalization_x
        .data.buffer,
      like.geometry.attributes
        .right_normal_and_texture_coordinate_normalization_y.data.buffer,
      like.geometry.attributes.batch_id?.data.buffer,
      like.geometry.indices.buffer,
    ].filter(isNotNullish),
  };
}
