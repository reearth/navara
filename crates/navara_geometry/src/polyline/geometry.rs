use navara_core::{Ellipsoid, CRS, LLE};
use navara_math::Vec3;
use radians::Radians;

use crate::helpers::vec::{append_flatten_vec3, get_position, unique_lle_with_delta_e};

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
    pub positions: Vec<LLE<f32, Radians>>,
    pub granularity: f32,
    pub crs: CRS,
    pub clamp_to_ground: bool,
}

impl Default for PolylineGeometryOptions {
    fn default() -> Self {
        Self {
            positions: Default::default(),
            crs: Default::default(),
            granularity: 9999.,
            clamp_to_ground: false,
        }
    }
}

// Ref: https://github.com/CesiumGS/cesium/blob/165e0fb4fcc9a448b15de6a2df46db23c71fffda/packages/engine/Source/Core/GroundPolylineGeometry.js#L458
pub fn create_polyline_geometry(
    ellipsoid: Ellipsoid<f32>,
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

    let cartographics = unique_lle_with_delta_e(cartographics, 9);
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
    );

    Some(PolylineGeometry {
        attributes,
        indices,
    })
}

#[cfg(test)]
mod test {
    use navara_core::{LLE, WGS84_32};
    use radians::Degrees;

    use super::{create_polyline_geometry, PolylineGeometryOptions};

    #[test]
    fn it_computes_positions_and_attributes_for_polylines() {
        let geometry = create_polyline_geometry(
            WGS84_32,
            PolylineGeometryOptions {
                positions: vec![
                    LLE::<f32, Degrees>::from_float(0.01, 0., 0.).rad(),
                    LLE::<f32, Degrees>::from_float(0.02, 0., 0.).rad(),
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
            WGS84_32,
            PolylineGeometryOptions {
                positions: vec![
                    LLE::<f32, Degrees>::from_float(0.01, 0., 0.).rad(),
                    LLE::<f32, Degrees>::from_float(0.02, 0., 0.).rad(),
                ],
                granularity: 600.0,
                ..Default::default()
            },
        )
        .unwrap();

        assert_eq!(geometry.indices.len(), 72);
        assert_eq!(geometry.attributes.position.data.len(), 48);

        let geometry = create_polyline_geometry(
            WGS84_32,
            PolylineGeometryOptions {
                positions: vec![
                    LLE::<f32, Degrees>::from_float(0.01, 0., 0.).rad(),
                    LLE::<f32, Degrees>::from_float(0.02, 0., 0.).rad(),
                    LLE::<f32, Degrees>::from_float(0.0201, 0., 0.).rad(),
                ],
                granularity: 600.0,
                ..Default::default()
            },
        )
        .unwrap();

        assert_eq!(geometry.indices.len(), 36 * 3);
        assert_eq!(geometry.attributes.position.data.len(), 24 * 3);
    }
}
