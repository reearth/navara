use crate::{
    helpers::vec::{append_flatten_vec3_with_index, unpack_flatten_vec3},
    FloatAttribute,
};

use super::{
    constants::REFERENCE_INDICES,
    helpers::{adjust_height, break_miter},
};

#[derive(Clone, Debug, Default, PartialEq)]
pub struct PolylineGeometryAttributes {
    pub position: FloatAttribute,
    pub start: FloatAttribute,
    pub forward_offset: FloatAttribute,
    pub start_normals: FloatAttribute,
    pub end_normal_and_texture_coordinate_normalization_x: FloatAttribute,
    pub right_normal_and_texture_coordinate_normalization_y: FloatAttribute,
}

// Ref: https://github.com/CesiumGS/cesium/blob/165e0fb4fcc9a448b15de6a2df46db23c71fffda/packages/engine/Source/Core/GroundPolylineGeometry.js#L1055
pub(super) fn generate_geometry_attributes(
    bottom_positions_array: Vec<f32>,
    top_positions_array: Vec<f32>,
    normals_array: Vec<f32>,
    _cartographics_array: Vec<f32>,
    clamp_to_ground: bool,
) -> (PolylineGeometryAttributes, Vec<u32>) {
    let segment_count = bottom_positions_array.len() / 3 - 1;
    let vertex_count = segment_count * 8;
    let array_size_vec3 = vertex_count * 3;
    let array_size_vec4 = vertex_count * 4;
    let index_count = segment_count * 36;

    let mut indices = vec![0; index_count];
    let mut positions_array = vec![0.; vertex_count * 3];

    let mut starts_array = vec![0.; array_size_vec3];
    let mut forward_offsets = vec![0.; array_size_vec3];
    let mut start_normals = vec![0.; array_size_vec3];
    let mut end_normal_and_texture_coordinate_normalization_x = vec![0.; array_size_vec4];
    let mut right_normal_and_texture_coordinate_normalization_y = vec![0.; array_size_vec4];

    // let cartographics_length_full = cartographics_array.len();
    // let cartographics_length = cartographics_length_full / 2;

    // For calculating the terrain height
    // let start_cartographic: LLE<f32, Radians> =
    //     LLE::from_float(cartographics_array[0], cartographics_array[1], 0.);
    // let end_cartographic: LLE<f32, Radians> = LLE::from_float(
    //     cartographics_array[cartographics_length_full - 2],
    //     cartographics_array[cartographics_length_full - 1],
    //     0.,
    // );

    // 3D
    let positions_length = top_positions_array.len() / 3;
    let mut segment_end_cartesian = unpack_flatten_vec3(&top_positions_array, 0);
    let mut length_3d = 0.;
    let mut index = 3;
    for _ in 1..positions_length {
        let segment_start_cartesian = segment_end_cartesian;
        segment_end_cartesian = unpack_flatten_vec3(&top_positions_array, index);
        length_3d += segment_start_cartesian.distance(segment_end_cartesian);
        index += 3;
    }

    // Generates segments

    index = 3;

    let mut end_bottom = unpack_flatten_vec3(&bottom_positions_array, 0);
    let mut end_top = unpack_flatten_vec3(&top_positions_array, 0);
    let mut end_geometry_normal = unpack_flatten_vec3(&normals_array, 0);

    let mut length_so_far_3d = 0.;

    // For the bounding sphere
    // let mut sum_heights = 0.;

    let mut miter_broken = None;

    let reference_indices_length = REFERENCE_INDICES.len();

    let mut vec3s_write_index = 0;
    let mut vec4s_write_index = 0;

    for _ in 0..segment_count {
        let start_bottom = end_bottom;
        let start_top = end_top;
        let mut start_geometry_normal = end_geometry_normal;

        if miter_broken.is_some() {
            start_geometry_normal = -start_geometry_normal;
        }

        end_bottom = unpack_flatten_vec3(&bottom_positions_array, index);
        end_top = unpack_flatten_vec3(&top_positions_array, index);
        end_geometry_normal = unpack_flatten_vec3(&normals_array, index);

        miter_broken = break_miter(end_geometry_normal, start_bottom, end_bottom, end_top);
        if let Some(miter_broken) = miter_broken {
            end_geometry_normal = miter_broken;
        }

        /****************************************
         * Geometry descriptors of a "line on terrain,"
         * as opposed to the "shadow volume used to draw
         * the line on terrain":
         * - position of start + offset to end
         * - start, end, and right-facing planes
         * - encoded texture coordinate offsets
         ****************************************/

        /* 3D */
        let segment_length_3d = start_top.distance(end_top);

        // TODO: Support the encoded vertex for f64.
        // let encoded_start = EncodedVec3::new(...);

        let forward_offset = end_bottom - start_bottom;
        let forward = forward_offset.normalize();

        let start_up = (start_top - start_bottom).normalize();
        let right_normal = forward.cross(start_up).normalize();

        let start_plane_normal = start_up.cross(start_geometry_normal).normalize();

        let end_up = (end_top - end_bottom).normalize();
        let end_plane_normal = end_geometry_normal.cross(end_up).normalize();

        let tex_coords_normal_3d_x = segment_length_3d / length_3d;
        let tex_coords_normal_3d_y = length_so_far_3d / length_3d;

        // Pack
        for j in 0..8 {
            let vec4_index = vec4s_write_index + j * 4;
            let vec3_index = vec3s_write_index + j * 3;
            let w_index = vec4_index + 3;

            let right_plane_side = if j < 4 { 1. } else { -1. };
            let top_bottom_side = if [2, 3, 6, 7].contains(&j) { 1.0 } else { -1. };

            append_flatten_vec3_with_index(&mut starts_array, &start_bottom, vec3_index);
            append_flatten_vec3_with_index(&mut forward_offsets, &forward_offset, vec3_index);
            append_flatten_vec3_with_index(&mut start_normals, &start_plane_normal, vec3_index);

            append_flatten_vec3_with_index(
                &mut end_normal_and_texture_coordinate_normalization_x,
                &end_plane_normal,
                vec4_index,
            );
            end_normal_and_texture_coordinate_normalization_x[w_index] =
                tex_coords_normal_3d_x * right_plane_side;

            append_flatten_vec3_with_index(
                &mut right_normal_and_texture_coordinate_normalization_y,
                &right_normal,
                vec4_index,
            );
            let mut tex_coord_normal = tex_coords_normal_3d_y * top_bottom_side;
            // TODO: I don't know why this is necessary. This might be unnecessary.
            if tex_coord_normal == 0. && top_bottom_side < 0. {
                tex_coord_normal = 9.; // Some value greater than 1.0.
            }
            right_normal_and_texture_coordinate_normalization_y[w_index] = tex_coord_normal;
        }

        // Adjust height of volume in 3D
        let min_height = 0.;
        let max_height = if clamp_to_ground { 9999. } else { 0. };
        // sum_heights += 0.; // For the bounding sphere

        let (adjust_height_start_bottom, adjust_height_start_top) =
            adjust_height(start_bottom, start_top, min_height, max_height);
        let (adjust_height_end_bottom, adjust_height_end_top) =
            adjust_height(end_bottom, end_top, min_height, max_height);

        append_flatten_vec3_with_index(
            &mut positions_array,
            &adjust_height_start_bottom,
            vec3s_write_index,
        );
        append_flatten_vec3_with_index(
            &mut positions_array,
            &adjust_height_end_bottom,
            vec3s_write_index + 3,
        );
        append_flatten_vec3_with_index(
            &mut positions_array,
            &adjust_height_end_top,
            vec3s_write_index + 6,
        );
        append_flatten_vec3_with_index(
            &mut positions_array,
            &adjust_height_start_top,
            vec3s_write_index + 9,
        );

        // TODO: Calculate the nudge here.

        append_flatten_vec3_with_index(
            &mut positions_array,
            &adjust_height_start_bottom,
            vec3s_write_index + 12,
        );
        append_flatten_vec3_with_index(
            &mut positions_array,
            &adjust_height_end_bottom,
            vec3s_write_index + 15,
        );
        append_flatten_vec3_with_index(
            &mut positions_array,
            &adjust_height_end_top,
            vec3s_write_index + 18,
        );
        append_flatten_vec3_with_index(
            &mut positions_array,
            &adjust_height_start_top,
            vec3s_write_index + 21,
        );

        index += 3;

        vec3s_write_index += 24;
        vec4s_write_index += 32;
        length_so_far_3d += segment_length_3d;
    }

    index = 0;
    let mut index_offset = 0;
    for _ in 0..segment_count {
        for j in 0..reference_indices_length {
            indices[index + j] = REFERENCE_INDICES[j] + index_offset;
        }
        index_offset += 8;
        index += reference_indices_length;
    }

    let attributes = PolylineGeometryAttributes {
        position: FloatAttribute::new(positions_array, 3),
        start: FloatAttribute::new(starts_array, 3),
        forward_offset: FloatAttribute::new(forward_offsets, 3),
        start_normals: FloatAttribute::new(start_normals, 3),
        end_normal_and_texture_coordinate_normalization_x: FloatAttribute::new(
            end_normal_and_texture_coordinate_normalization_x,
            4,
        ),
        right_normal_and_texture_coordinate_normalization_y: FloatAttribute::new(
            right_normal_and_texture_coordinate_normalization_y,
            4,
        ),
    };

    // TODO: Bounding sphere

    (attributes, indices)
}
