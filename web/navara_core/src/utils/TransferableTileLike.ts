import type {
  CachedMeshHandle,
  TileXYZ,
  TransferableTile,
} from "@navara/engine";

export class TransferableTileLike {
  cached_mesh_handle?: CachedMeshHandleLike | undefined;
  coords: TileXYZLike;
  max_height: number;

  constructor(t: TransferableTile) {
    this.cached_mesh_handle = t.cached_mesh_handle
      ? new CachedMeshHandleLike(t.cached_mesh_handle)
      : undefined;
    this.coords = new TileXYZLike(t.coords);
    this.max_height = t.max_height;
  }

  free(): void {}
}

export class TileXYZLike implements TileXYZ {
  x: number;
  y: number;
  z: number;

  constructor(t: TileXYZ) {
    this.x = t.x;
    this.y = t.y;
    this.z = t.z;
  }

  free(): void {}
}

export class CachedMeshHandleLike {
  vertices: number;
  uvs: number;
  indices: number;
  heights?: number | undefined;

  constructor(t: CachedMeshHandle) {
    this.vertices = t.vertices;
    this.uvs = t.uvs;
    this.indices = t.indices;
    this.heights = t.heights;
  }

  free(): void {}
}
