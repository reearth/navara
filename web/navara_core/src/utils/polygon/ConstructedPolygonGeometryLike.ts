import type { ConstructedPolygonGeometry } from "@navara/engine";

import { ExtentRadianF32Like } from "../ExtentRadianF32Like";

export class ConstructedPolygonGeometryLike {
  extent: ExtentRadianF32Like;
  position: Float32Array;
  position_size: number;
  normal: Float32Array | undefined;
  normal_size: number | undefined;
  scale_normal_and_cap: Float32Array | undefined;
  scale_normal_and_cap_size: number | undefined;
  batch_id: Float32Array | undefined;
  batch_id_size: number | undefined;
  batch_index: Uint32Array | undefined;
  batch_index_size: number | undefined;
  indices: Uint32Array;

  constructor(t: ConstructedPolygonGeometry) {
    this.extent = new ExtentRadianF32Like(t.extent);
    // Need to make a slice to avoid memory leak due to it's transferred.
    this.position = t.position().slice();
    this.position_size = t.position_size();
    this.normal = t.normal()?.slice();
    this.normal_size = t.normal_size();
    this.scale_normal_and_cap = t.scale_normal_and_cap()?.slice();
    this.scale_normal_and_cap_size = t.scale_normal_and_cap_size();
    this.batch_id = t.batch_id()?.slice();
    this.batch_id_size = t.batch_id_size();
    this.batch_index = t.batch_index()?.slice();
    this.batch_index_size = t.batch_index_size();
    this.indices = t.indices().slice();
  }
}
