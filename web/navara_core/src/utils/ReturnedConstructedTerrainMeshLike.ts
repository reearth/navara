import type { ReturnedConstructedTerrainMesh } from "@navara/engine";

import type { RemoveFreeRecursively } from "../types";

import { Vec3Like } from "./Vec3Like";

export class ReturnedConstructedTerrainMeshLike implements RemoveFreeRecursively<ReturnedConstructedTerrainMesh> {
  vertices: Float32Array;
  uvs: Float32Array;
  indices: Uint32Array;
  heights: Float32Array;
  max_height: number;
  min_height: number;
  rtc_translation: Vec3Like | undefined;
  skirt_vertices: Float32Array | undefined;
  skirt_uvs: Float32Array | undefined;
  skirt_indices: Uint32Array | undefined;
  skirt_indices_to_edge: Uint32Array | undefined;

  constructor(t: ReturnedConstructedTerrainMesh) {
    this.vertices = t.transferVertices().slice();
    this.uvs = t.transferUvs().slice();
    this.indices = t.transferIndices().slice();
    this.heights = t.transferHeights().slice();
    this.max_height = t.max_height;
    this.min_height = t.min_height;
    this.rtc_translation = t.rtc_translation
      ? new Vec3Like(t.rtc_translation)
      : undefined;
    if (t.hasSkirt()) {
      this.skirt_vertices = t.transferSkirtVertices()?.slice();
      this.skirt_uvs = t.transferSkirtUvs()?.slice();
      this.skirt_indices = t.transferSkirtIndices()?.slice();
      this.skirt_indices_to_edge = t.transferSkirtIndicesToEdge()?.slice();
    }
  }

  transferVertices(): Float32Array {
    throw new Error();
  }
  transferUvs(): Float32Array {
    throw new Error();
  }
  transferIndices(): Uint32Array {
    throw new Error();
  }
  transferHeights(): Float32Array {
    throw new Error();
  }
  transferSkirtVertices(): Float32Array | undefined {
    throw new Error();
  }
  transferSkirtUvs(): Float32Array | undefined {
    throw new Error();
  }
  transferSkirtIndices(): Uint32Array | undefined {
    throw new Error();
  }
  transferSkirtIndicesToEdge(): Uint32Array | undefined {
    throw new Error();
  }
  hasSkirt(): boolean {
    return (
      this.skirt_vertices !== undefined &&
      this.skirt_uvs !== undefined &&
      this.skirt_indices !== undefined &&
      this.skirt_indices_to_edge !== undefined
    );
  }
}
