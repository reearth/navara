import type { ConstructedPolylineGeometry } from "@navara/engine";

import { ExtentRadianF32Like } from "../ExtentRadianF32Like";

export class ConstructedPolylineGeometryLike {
  extent: ExtentRadianF32Like;
  position: Float32Array;
  position_size: number;
  start: Float32Array;
  start_size: number;
  forward_offset: Float32Array;
  forward_offset_size: number;
  start_normals: Float32Array;
  start_normals_size: number;
  end_normal_and_texture_coordinate_normalization_x: Float32Array;
  end_normal_and_texture_coordinate_normalization_x_size: number;
  right_normal_and_texture_coordinate_normalization_y: Float32Array;
  right_normal_and_texture_coordinate_normalization_y_size: number;
  batch_id: Float32Array | undefined;
  batch_id_size: number | undefined;
  indices: Uint32Array;

  constructor(t: ConstructedPolylineGeometry) {
    this.extent = new ExtentRadianF32Like(t.extent);
    // Need to make a slice to avoid memory leak due to it's transferred.
    this.position = t.position().slice();
    this.position_size = t.position_size();
    this.start = t.start().slice();
    this.start_size = t.start_size();
    this.forward_offset = t.forward_offset().slice();
    this.forward_offset_size = t.forward_offset_size();
    this.start_normals = t.start_normals().slice();
    this.start_normals_size = t.start_normals_size();
    this.end_normal_and_texture_coordinate_normalization_x = t
      .end_normal_and_texture_coordinate_normalization_x()
      .slice();
    this.end_normal_and_texture_coordinate_normalization_x_size =
      t.end_normal_and_texture_coordinate_normalization_x_size();
    this.right_normal_and_texture_coordinate_normalization_y = t
      .right_normal_and_texture_coordinate_normalization_y()
      .slice();
    this.right_normal_and_texture_coordinate_normalization_y_size =
      t.right_normal_and_texture_coordinate_normalization_y_size();
    this.batch_id = t.batch_id()?.slice();
    this.batch_id_size = t.batch_id_size();
    this.indices = t.indices().slice();
  }
}
