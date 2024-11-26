import type {
  TransferableTileLike,
  TileXYZLike,
  CachedMeshHandleLike,
} from "@navara/core";
import {
  CachedMeshHandle,
  TileXYZ,
  TransferableTile,
} from "@navara/engine-worker";

export function toTransferableTile(like: TransferableTileLike) {
  return new TransferableTile(
    toTileXYZ(like.coords),
    like.max_height,
    like.cached_mesh_handle
      ? toCachedMeshHandle(like.cached_mesh_handle)
      : undefined,
  );
}

export function toTileXYZ(like: TileXYZLike) {
  return new TileXYZ(like.x, like.y, like.z);
}

export function toCachedMeshHandle(like: CachedMeshHandleLike) {
  return new CachedMeshHandle(
    like.vertices,
    like.indices,
    like.uvs,
    like.heights,
  );
}
