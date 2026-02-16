use navara_core::{Ellipsoid, CRS, LLE};
use navara_math::Vec3;
use radians::Radians;

use crate::helpers::vec::{append_flatten_vec3, get_position, unique_with_delta_e};

use super::{
    attributes::{generate_geometry_attributes, PolylineGeometryAttributes},
    constants::{WALL_INITIAL_MAX_HEIGHT, WALL_INITIAL_MIN_HEIGHT},
    helpers::{compute_right_normal, compute_vertex_miter_normal, interpolate_segment},
};

#[derive(Clone, Debug, Default, PartialEq)]
pub struct PolylineGeometry {
    pub attributes: PolylineGeometryAttributes,
    pub indices: Vec<u32>,
}

pub struct PolylineGeometryOptions {
    pub positions: Vec<LLE<f64, Radians>>,
    pub granularity: f64,
    pub crs: CRS,
    pub clamp_to_ground: bool,
    pub use_rte: bool,
}

impl Default for PolylineGeometryOptions {
    fn default() -> Self {
        Self {
            positions: Default::default(),
            crs: Default::default(),
            granularity: 9999.,
            clamp_to_ground: false,
            use_rte: false,
        }
    }
}

// Ref: https://github.com/CesiumGS/cesium/blob/165e0fb4fcc9a448b15de6a2df46db23c71fffda/packages/engine/Source/Core/GroundPolylineGeometry.js#L458
pub fn create_polyline_geometry(
    ellipsoid: Ellipsoid<f64>,
    options: PolylineGeometryOptions,
) -> Option<PolylineGeometry> {
    let granularity = options.granularity;
    let crs = &options.crs;
    let positions = &options.positions;
    let cartographics = match crs {
        CRS::Geographic => positions,

        // TODO: Convert it to geographic coordinates system
        CRS::Geocentric => unimplemented!(),
        CRS::ESPG { code: _code } => unimplemented!(),
    };

    let cartographics = unique_with_delta_e(cartographics, 9);
    let cartographics_length = cartographics.len();

    if cartographics_length < 2 {
        return None;
    }

    // ----- Build heap-side arrays for positions, interpolated cartographics, and normals from which to compute vertices -----
    // We build a "wall" and then decompose it into separately connected component "volumes" because we need a lot
    // of information about the wall. Also, this simplifies interpolation.
    // Convention: "next" and "end" are locally forward to each segment of the wall,
    // and we are computing normals pointing towards the local right side of the vertices in each segment.
    let mut cartographics_array = vec![];
    let mut normals_array = vec![];
    let mut bottom_positions_array = vec![];
    let mut top_positions_array = vec![];

    // Start points

    let start_cartographic = cartographics[0];
    let next_cartographic = cartographics[1];

    let mut previous_bottom: Vec3;
    let mut next_bottom = get_position(ellipsoid, &next_cartographic, WALL_INITIAL_MIN_HEIGHT);
    let mut vertex_bottom = get_position(ellipsoid, &start_cartographic, WALL_INITIAL_MIN_HEIGHT);
    let mut vertex_top = get_position(ellipsoid, &start_cartographic, WALL_INITIAL_MAX_HEIGHT);

    let mut vertex_normal = compute_right_normal(
        &start_cartographic,
        &next_cartographic,
        WALL_INITIAL_MAX_HEIGHT,
        ellipsoid,
    );

    append_flatten_vec3(&mut normals_array, &vertex_normal);
    append_flatten_vec3(&mut bottom_positions_array, &vertex_bottom);
    append_flatten_vec3(&mut top_positions_array, &vertex_top);
    cartographics_array.append(&mut vec![
        start_cartographic.lat.val(),
        start_cartographic.lng.val(),
    ]);

    interpolate_segment(
        ellipsoid,
        start_cartographic,
        next_cartographic,
        WALL_INITIAL_MIN_HEIGHT,
        WALL_INITIAL_MAX_HEIGHT,
        granularity,
        |normal, bottom, top, cart| {
            append_flatten_vec3(&mut normals_array, &normal);
            append_flatten_vec3(&mut bottom_positions_array, &bottom);
            append_flatten_vec3(&mut top_positions_array, &top);
            cartographics_array.append(&mut vec![cart.lat.val(), cart.lng.val()]);
        },
    );

    // All in-between points
    for i in 1..(cartographics_length - 1) {
        previous_bottom = vertex_bottom;
        vertex_bottom = next_bottom;

        let vertex_cartographic = cartographics[i];
        vertex_top = get_position(ellipsoid, &vertex_cartographic, WALL_INITIAL_MAX_HEIGHT);
        next_bottom = get_position(ellipsoid, &cartographics[i + 1], WALL_INITIAL_MIN_HEIGHT);

        vertex_normal =
            compute_vertex_miter_normal(previous_bottom, vertex_bottom, vertex_top, next_bottom);

        append_flatten_vec3(&mut normals_array, &vertex_normal);
        append_flatten_vec3(&mut bottom_positions_array, &vertex_bottom);
        append_flatten_vec3(&mut top_positions_array, &vertex_top);
        cartographics_array.append(&mut vec![
            vertex_cartographic.lat.val(),
            vertex_cartographic.lng.val(),
        ]);

        interpolate_segment(
            ellipsoid,
            cartographics[i],
            cartographics[i + 1],
            WALL_INITIAL_MIN_HEIGHT,
            WALL_INITIAL_MAX_HEIGHT,
            granularity,
            |normal, bottom, top, cart| {
                append_flatten_vec3(&mut normals_array, &normal);
                append_flatten_vec3(&mut bottom_positions_array, &bottom);
                append_flatten_vec3(&mut top_positions_array, &top);
                cartographics_array.append(&mut vec![cart.lat.val(), cart.lng.val()]);
            },
        )
    }

    // End points

    let end_cartographic = cartographics[cartographics_length - 1];
    let pre_end_cartographic = cartographics[cartographics_length - 2];

    vertex_bottom = get_position(ellipsoid, &end_cartographic, WALL_INITIAL_MIN_HEIGHT);
    vertex_top = get_position(ellipsoid, &end_cartographic, WALL_INITIAL_MAX_HEIGHT);

    vertex_normal = compute_right_normal(
        &pre_end_cartographic,
        &end_cartographic,
        WALL_INITIAL_MAX_HEIGHT,
        ellipsoid,
    );

    append_flatten_vec3(&mut normals_array, &vertex_normal);
    append_flatten_vec3(&mut bottom_positions_array, &vertex_bottom);
    append_flatten_vec3(&mut top_positions_array, &vertex_top);
    cartographics_array.append(&mut vec![
        end_cartographic.lat.val(),
        end_cartographic.lng.val(),
    ]);

    let (attributes, indices) = generate_geometry_attributes(
        bottom_positions_array,
        top_positions_array,
        normals_array,
        cartographics_array,
        options.clamp_to_ground,
        options.use_rte,
    );

    Some(PolylineGeometry {
        attributes,
        indices,
    })
}

/// Options for creating flat polyline geometry in Cartesian coordinates
pub struct FlatPolylineGeometryOptions {
    /// Positions in Cartesian coordinates (already converted from source CRS)
    pub positions: Vec<navara_math::Vec3>,
    /// Line width
    pub width: f32,
}

impl Default for FlatPolylineGeometryOptions {
    fn default() -> Self {
        Self {
            positions: vec![],
            width: 1.0,
        }
    }
}

/// Creates a flat polyline geometry from positions in Cartesian coordinates.
/// This function creates simple quad strips for the polyline, suitable for 2D texture rendering.
/// The geometry uses X/Y positions for the flat plane.
pub fn create_flat_polyline_geometry(
    options: FlatPolylineGeometryOptions,
) -> Option<PolylineGeometry> {
    let positions = &options.positions;

    if positions.len() < 2 {
        return None;
    }

    let mut flat_positions = vec![];
    let mut start_positions = vec![];
    let mut forward_offsets = vec![];
    let mut start_normals = vec![];
    let mut end_normal_and_tex_x = vec![];
    let mut right_normal_and_tex_y = vec![];
    let mut indices = vec![];

    let mut total_length = 0.0_f32;
    let mut segment_lengths = vec![];

    // Calculate segment lengths for texture coordinate normalization
    for i in 0..(positions.len() - 1) {
        let p0 = positions[i];
        let p1 = positions[i + 1];
        let dx = (p1.x - p0.x) as f32;
        let dy = (p1.y - p0.y) as f32;
        let len = (dx * dx + dy * dy).sqrt();
        segment_lengths.push(len);
        total_length += len;
    }

    let mut accumulated_length = 0.0_f32;
    let mut vertex_index = 0u32;

    for i in 0..(positions.len() - 1) {
        let p0 = positions[i];
        let p1 = positions[i + 1];

        // Direction vector
        let dx = (p1.x - p0.x) as f32;
        let dy = (p1.y - p0.y) as f32;
        let len = segment_lengths[i];
        if len < 1e-10 {
            continue;
        }

        // Normalize direction
        let dir_x = dx / len;
        let dir_y = dy / len;

        // Right normal (perpendicular to direction)
        let right_x = -dir_y;
        let right_y = dir_x;

        // Texture coordinates
        let tex_x_start = if total_length > 0.0 {
            accumulated_length / total_length
        } else {
            0.0
        };
        let tex_x_end = if total_length > 0.0 {
            (accumulated_length + len) / total_length
        } else {
            1.0
        };

        // Create 4 vertices for this segment (2 at start, 2 at end)
        // Each vertex has: position (3), start (3), forward_offset (3), start_normal (3),
        // end_normal_and_tex_x (4), right_normal_and_tex_y (4)

        // Vertex 0: start, left side
        flat_positions.extend_from_slice(&[p0.x as f32, p0.y as f32, 0.0]);
        start_positions.extend_from_slice(&[p0.x as f32, p0.y as f32, 0.0]);
        forward_offsets.extend_from_slice(&[dir_x, dir_y, 0.0]);
        start_normals.extend_from_slice(&[right_x, right_y, 0.0]);
        end_normal_and_tex_x.extend_from_slice(&[right_x, right_y, 0.0, tex_x_start]);
        right_normal_and_tex_y.extend_from_slice(&[right_x, right_y, 0.0, 1.0]); // left side = 1.0

        // Vertex 1: start, right side
        flat_positions.extend_from_slice(&[p0.x as f32, p0.y as f32, 0.0]);
        start_positions.extend_from_slice(&[p0.x as f32, p0.y as f32, 0.0]);
        forward_offsets.extend_from_slice(&[dir_x, dir_y, 0.0]);
        start_normals.extend_from_slice(&[right_x, right_y, 0.0]);
        end_normal_and_tex_x.extend_from_slice(&[right_x, right_y, 0.0, tex_x_start]);
        right_normal_and_tex_y.extend_from_slice(&[right_x, right_y, 0.0, -1.0]); // right side = -1.0

        // Vertex 2: end, left side
        flat_positions.extend_from_slice(&[p1.x as f32, p1.y as f32, 0.0]);
        start_positions.extend_from_slice(&[p0.x as f32, p0.y as f32, 0.0]);
        forward_offsets.extend_from_slice(&[dir_x, dir_y, 0.0]);
        start_normals.extend_from_slice(&[right_x, right_y, 0.0]);
        end_normal_and_tex_x.extend_from_slice(&[right_x, right_y, 0.0, tex_x_end]);
        right_normal_and_tex_y.extend_from_slice(&[right_x, right_y, 0.0, 1.0]); // left side = 1.0

        // Vertex 3: end, right side
        flat_positions.extend_from_slice(&[p1.x as f32, p1.y as f32, 0.0]);
        start_positions.extend_from_slice(&[p0.x as f32, p0.y as f32, 0.0]);
        forward_offsets.extend_from_slice(&[dir_x, dir_y, 0.0]);
        start_normals.extend_from_slice(&[right_x, right_y, 0.0]);
        end_normal_and_tex_x.extend_from_slice(&[right_x, right_y, 0.0, tex_x_end]);
        right_normal_and_tex_y.extend_from_slice(&[right_x, right_y, 0.0, -1.0]); // right side = -1.0

        // Two triangles: (0, 1, 2), (1, 3, 2)
        indices.push(vertex_index);
        indices.push(vertex_index + 1);
        indices.push(vertex_index + 2);
        indices.push(vertex_index + 1);
        indices.push(vertex_index + 3);
        indices.push(vertex_index + 2);

        vertex_index += 4;
        accumulated_length += len;
    }

    if flat_positions.is_empty() {
        return None;
    }

    Some(PolylineGeometry {
        attributes: PolylineGeometryAttributes {
            position: crate::FloatAttribute::new(flat_positions, 3),
            position_high: None,
            position_low: None,
            start: crate::FloatAttribute::new(start_positions, 3),
            start_high: None,
            start_low: None,
            forward_offset: crate::FloatAttribute::new(forward_offsets, 3),
            end_high: None,
            end_low: None,
            start_normals: crate::FloatAttribute::new(start_normals, 3),
            end_normal_and_texture_coordinate_normalization_x: crate::FloatAttribute::new(
                end_normal_and_tex_x,
                4,
            ),
            right_normal_and_texture_coordinate_normalization_y: crate::FloatAttribute::new(
                right_normal_and_tex_y,
                4,
            ),
            batch_ids: None,
            batch_index: None,
        },
        indices,
    })
}

#[cfg(test)]
mod test {
    use navara_core::{LLE, WGS84_64};
    use radians::Degrees;

    use super::{
        create_flat_polyline_geometry, create_polyline_geometry, FlatPolylineGeometryOptions,
        PolylineGeometryOptions,
    };

    #[test]
    fn it_computes_positions_and_attributes_for_polylines() {
        let geometry = create_polyline_geometry(
            WGS84_64,
            PolylineGeometryOptions {
                positions: vec![
                    LLE::<f64, Degrees>::from_float(0.01, 0., 0.).rad(),
                    LLE::<f64, Degrees>::from_float(0.02, 0., 0.).rad(),
                ],
                granularity: 0.0,
                ..Default::default()
            },
        )
        .unwrap();

        assert_eq!(geometry.indices.len(), 36);
        assert_eq!(geometry.attributes.position.data.len(), 24);

        // let values = geometry
        //     .attributes
        //     .end_normal_and_texture_coordinate_normalization_x
        //     .data;
        // for i in 0..4 {
        //     let index = i * 4 + 3;
        //     assert_eq!(values[index].sin(), 1.0);
        // }

        let geometry = create_polyline_geometry(
            WGS84_64,
            PolylineGeometryOptions {
                positions: vec![
                    LLE::<f64, Degrees>::from_float(0.01, 0., 0.).rad(),
                    LLE::<f64, Degrees>::from_float(0.02, 0., 0.).rad(),
                ],
                granularity: 600.0,
                ..Default::default()
            },
        )
        .unwrap();

        assert_eq!(geometry.indices.len(), 72);
        assert_eq!(geometry.attributes.position.data.len(), 48);

        let geometry = create_polyline_geometry(
            WGS84_64,
            PolylineGeometryOptions {
                positions: vec![
                    LLE::<f64, Degrees>::from_float(0.01, 0., 0.).rad(),
                    LLE::<f64, Degrees>::from_float(0.02, 0., 0.).rad(),
                    LLE::<f64, Degrees>::from_float(0.0201, 0., 0.).rad(),
                ],
                granularity: 600.0,
                ..Default::default()
            },
        )
        .unwrap();

        assert_eq!(geometry.indices.len(), 36 * 3);
        assert_eq!(geometry.attributes.position.data.len(), 24 * 3);
    }

    #[test]
    fn it_computes_flat_polyline_geometry() {
        use navara_math::Vec3;

        // Single segment
        let geometry = create_flat_polyline_geometry(FlatPolylineGeometryOptions {
            positions: vec![Vec3::new(0.0, 0.0, 0.0), Vec3::new(1.0, 0.0, 0.0)],
            width: 1.0,
        })
        .unwrap();

        // 1 segment = 4 vertices, 6 indices (2 triangles)
        assert_eq!(geometry.indices.len(), 6);
        assert_eq!(geometry.attributes.position.data.len() / 3, 4);

        // Two segments
        let geometry = create_flat_polyline_geometry(FlatPolylineGeometryOptions {
            positions: vec![
                Vec3::new(0.0, 0.0, 0.0),
                Vec3::new(1.0, 0.0, 0.0),
                Vec3::new(2.0, 1.0, 0.0),
            ],
            width: 1.0,
        })
        .unwrap();

        // 2 segments = 8 vertices, 12 indices (4 triangles)
        assert_eq!(geometry.indices.len(), 12);
        assert_eq!(geometry.attributes.position.data.len() / 3, 8);
    }
}
