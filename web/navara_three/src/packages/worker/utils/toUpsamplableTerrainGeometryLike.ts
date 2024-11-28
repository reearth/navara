import { UpsamplableTerrainGeometry } from "@navara/engine-worker";

export function toUpsamplableTerrainGeometry(like: UpsamplableTerrainGeometry) {
  return new UpsamplableTerrainGeometry(like.uvs, like.indices, like.heights);
}
