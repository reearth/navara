import type { UpsamplableTerrainGeometryLike } from "@navaramap/core";
import { UpsamplableTerrainGeometry } from "@navaramap/engine-worker";

export function toUpsamplableTerrainGeometry(
  like: UpsamplableTerrainGeometryLike,
) {
  return new UpsamplableTerrainGeometry(
    like.uvs,
    like.indices,
    like.heights,
    like.normals,
    like.watermask,
  );
}
