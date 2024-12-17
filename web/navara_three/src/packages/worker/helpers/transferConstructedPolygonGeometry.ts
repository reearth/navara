import { isNotNullish } from "@navara/core";
import type { ConstructedPolygonGeometry } from "@navara/engine-worker";

import { ConstructedPolygonGeometryLike } from "../../core/utils/polygon/ConstructedPolygonGeometryLike";

export function transferConstructedPolygonGeometry(
  r: ConstructedPolygonGeometry,
) {
  const like = new ConstructedPolygonGeometryLike(r);
  return {
    result: like,
    transfers: [
      like.geometry.attributes.batch_id?.data.buffer,
      like.geometry.attributes.normal?.data.buffer,
      like.geometry.attributes.position?.data.buffer,
      like.geometry.attributes.scale_normal_and_cap?.data.buffer,
      like.geometry.indices.buffer,
    ].filter(isNotNullish),
  };
}
