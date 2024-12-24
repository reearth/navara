import type { UpsamplableTerrainGeometryLike } from "@navara/core";
import { UpsamplableTerrainGeometry } from "@navara/engine-worker";

export function toUpsamplableTerrainGeometry(
  like: UpsamplableTerrainGeometryLike,
) {
  return new UpsamplableTerrainGeometry(like.uvs, like.indices, like.heights);
}
