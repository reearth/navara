import type { ConstructedPolylineGeometry } from "@navara/engine";

import { ExtentRadianF32Like } from "../ExtentRadianF32Like";

export class ConstructedPolylineGeometryLike {
  extent: ExtentRadianF32Like | undefined;
  position: Float32Array;
  position_size: number;
  position_high: Float32Array | undefined;
  position_high_size: number | undefined;
  position_low: Float32Array | undefined;
  position_low_size: number | undefined;
  start: Float32Array;
  start_size: number;
  start_high: Float32Array | undefined;
  start_high_size: number | undefined;
  start_low: Float32Array | undefined;
  start_low_size: number | undefined;
  forward_offset: Float32Array;
  forward_offset_size: number;
  end_high: Float32Array | undefined;
  end_high_size: number | undefined;
  end_low: Float32Array | undefined;
  end_low_size: number | undefined;
  start_normals: Float32Array;
  start_normals_size: number;
  end_normal_and_texture_coordinate_normalization_x: Float32Array;
  end_normal_and_texture_coordinate_normalization_x_size: number;
  right_normal_and_texture_coordinate_normalization_y: Float32Array;
  right_normal_and_texture_coordinate_normalization_y_size: number;
  batch_id: Float32Array | undefined;
  batch_id_size: number | undefined;
  batch_index: Uint32Array | undefined;
  batch_index_size: number | undefined;
  indices: Uint32Array;

  constructor(t: ConstructedPolylineGeometry) {
    const extent = t.extent;
    this.extent = extent ? new ExtentRadianF32Like(extent) : undefined;
    // Need to make a slice to avoid memory leak due to it's transferred.
    this.position = t.position().slice();
    this.position_size = t.position_size();
    this.position_high = t.position_high()?.slice();
    this.position_high_size = t.position_high_size();
    this.position_low = t.position_low()?.slice();
    this.position_low_size = t.position_low_size();
    this.start = t.start().slice();
    this.start_size = t.start_size();
    this.start_high = t.start_high()?.slice();
    this.start_high_size = t.start_high_size();
    this.start_low = t.start_low()?.slice();
    this.start_low_size = t.start_low_size();
    this.forward_offset = t.forward_offset().slice();
    this.forward_offset_size = t.forward_offset_size();
    this.end_high = t.end_high()?.slice();
    this.end_high_size = t.end_high_size();
    this.end_low = t.end_low()?.slice();
    this.end_low_size = t.end_low_size();
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
    this.batch_index = t.batch_index()?.slice();
    this.batch_index_size = t.batch_index_size();
    this.indices = t.indices().slice();
  }
}
