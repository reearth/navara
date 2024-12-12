use navara_core::{Ellipsoid, CRS, WGS84_32};
use navara_math::{EqualEpsilon, FloatType, Vec3, EPSILON10, RADIANS_PER_DEGREE};

use crate::{helpers::vec::unpack_flatten_vec3, FloatAttribute};

use super::{
    helpers::{
        compute_wall_geometry, create_geometry_from_positions, polygons_from_hierarchy,
        project_to_2d, scale_to_geodetic_height_extruded,
    },
    types::{Hierarchy, Polygon},
    PolygonGeometryAttributes, PolygonResource, WindingOrder,
};

#[derive(Clone, Debug, Default, PartialEq)]
pub struct PolygonGeometry {
    pub attributes: PolygonGeometryAttributes,
    pub indices: Vec<u32>,
}

pub struct PolygonGeometryOptions {
    pub hierarchy: Hierarchy,
    pub granularity: f32,
    pub crs: CRS,
    pub clamp_to_ground: bool,
    pub extruded_height: f32,
    pub height: f32,
}

impl Default for PolygonGeometryOptions {
    fn default() -> Self {
        Self {
            hierarchy: Hierarchy {
                outer_ring: vec![],
                holes: None,
                expected_winding_order: WindingOrder::Unknown,
            },
            granularity: RADIANS_PER_DEGREE,
            crs: Default::default(),
            clamp_to_ground: false,
            extruded_height: 0.,
            height: 1.,
        }
    }
}

pub struct PolygonGeometryResult {
    pub geometry: PolygonGeometry,
}

// Ref: https://github.com/CesiumGS/cesium/blob/baaabaa49058067c855ad050be73a9cdfe9b6ac7/packages/engine/Source/Core/PolygonGeometry.js#L1278
pub fn create_polygon_geometry(
    options: PolygonGeometryOptions,
    polygon_resource: &mut PolygonResource,
) -> Option<PolygonGeometryResult> {
    let granularity = options.granularity;
    let polygon_hierarchy = &options.hierarchy;

    let outer_positions = &polygon_hierarchy.outer_ring;
    if outer_positions.len() < 3 {
        return None;
    }

    let (polygons, hierarchies) =
        polygons_from_hierarchy(polygon_hierarchy, project_to_2d(WGS84_32, outer_positions));

    if hierarchies.is_empty() {
        return None;
    }

    let mut geometries = vec![];

    let polygons_length = polygons.len();
    for i in 0..polygons_length {
        let mut split_geometry = create_geometry_from_positions_extruded(
            WGS84_32,
            polygon_resource,
            &polygons[i],
            granularity,
            &hierarchies[i],
        );

        let top_bottom_normals =
            compute_extruded_normals(WGS84_32, &split_geometry.top_bottom_geometry, false);

        let wall_normals = compute_extruded_normals(WGS84_32, &split_geometry.wall_geometry, true);

        split_geometry.top_bottom_geometry.attributes.normal =
            Some(FloatAttribute::new(top_bottom_normals, 3));
        split_geometry.wall_geometry.attributes.normal = Some(FloatAttribute::new(wall_normals, 3));

        geometries.push(split_geometry.top_bottom_geometry);
        geometries.push(split_geometry.wall_geometry);
    }

    let mut combined_attributes = PolygonGeometryAttributes {
        position: FloatAttribute::new(vec![], 3),
        normal: Some(FloatAttribute::new(vec![], 3)),
        scale_normal_and_cap: Some(FloatAttribute::new(vec![], 4)),
        batch_id: None,
    };
    let mut indices = vec![];

    let mut index_offset = 0;
    // Combine all attributes into one geometry
    for mut geometry in geometries {
        let position_length = geometry.attributes.position.data.len() / 3;
        combined_attributes
            .position
            .data
            .append(&mut geometry.attributes.position.data);
        combined_attributes
            .normal
            .as_mut()
            .unwrap()
            .data
            .append(&mut geometry.attributes.normal.unwrap().data);
        combined_attributes
            .scale_normal_and_cap
            .as_mut()
            .unwrap()
            .data
            .append(&mut geometry.attributes.scale_normal_and_cap.unwrap().data);

        if index_offset == 0 {
            indices.append(&mut geometry.indices);
        } else {
            let mut new_indices = geometry
                .indices
                .into_iter()
                .map(|i| i + index_offset)
                .collect::<Vec<_>>();
            indices.append(&mut new_indices);
        }

        index_offset += position_length as u32;
    }

    Some(PolygonGeometryResult {
        geometry: PolygonGeometry {
            attributes: combined_attributes,
            indices,
        },
    })
}

pub struct ExtrudedPolygonGeometry {
    pub top_bottom_geometry: PolygonGeometry,
    pub wall_geometry: PolygonGeometry,
}

// Ref: https://github.com/CesiumGS/cesium/blob/baaabaa49058067c855ad050be73a9cdfe9b6ac7/packages/engine/Source/Core/PolygonGeometry.js#L428
pub fn create_geometry_from_positions_extruded(
    ellipsoid: Ellipsoid<FloatType>,
    polygon_resource: &mut PolygonResource,
    polygon: &Polygon,
    granularity: FloatType,
    hierarchy: &Hierarchy,
) -> ExtrudedPolygonGeometry {
    let (mut top_positions, mut top_indices) =
        create_geometry_from_positions(ellipsoid, polygon_resource, polygon, granularity);

    let mut top_bottom_positions = Vec::with_capacity(top_positions.len() * 2);
    top_bottom_positions.append(&mut top_positions.clone());
    top_bottom_positions.append(&mut top_positions);

    let bottom_positions_length = top_bottom_positions.len() / 3 / 2;
    let top_indices_length = top_indices.len();
    let mut top_bottom_indices = Vec::with_capacity(top_indices_length * 2);
    top_bottom_indices.append(&mut top_indices);
    for i in 0..(top_indices_length / 3) {
        let i = i * 3;
        let i0 = top_bottom_indices[i] + bottom_positions_length as u32;
        let i1 = top_bottom_indices[i + 1] + bottom_positions_length as u32;
        let i2 = top_bottom_indices[i + 2] + bottom_positions_length as u32;

        top_bottom_indices.push(i2);
        top_bottom_indices.push(i1);
        top_bottom_indices.push(i0);
    }

    let scale_normal_and_cap =
        scale_to_geodetic_height_extruded(&mut top_bottom_positions, ellipsoid);

    let outer_ring = &hierarchy.outer_ring;
    let (mut wall_positions, mut wall_indices) =
        compute_wall_geometry(ellipsoid, outer_ring, granularity);

    let mut wall_scale_normal_and_cap =
        scale_to_geodetic_height_extruded(&mut wall_positions, ellipsoid);

    if let Some(holes_src) = &hierarchy.holes {
        let mut pos_cnt = (wall_positions.len() / 3) as u32;
        for hole_src in holes_src {
            let (mut hole_wall_pos, hole_wall_i) =
                compute_wall_geometry(ellipsoid, &hole_src.outer_ring, granularity);

            let mut hole_scale_normal_and_cap =
                scale_to_geodetic_height_extruded(&mut hole_wall_pos, ellipsoid);

            wall_positions.append(&mut hole_wall_pos);
            wall_scale_normal_and_cap.append(&mut hole_scale_normal_and_cap);

            for i in hole_wall_i {
                wall_indices.push(pos_cnt + i);
            }

            pos_cnt = (wall_positions.len() / 3) as u32;
        }
    }

    ExtrudedPolygonGeometry {
        top_bottom_geometry: PolygonGeometry {
            attributes: PolygonGeometryAttributes {
                position: FloatAttribute::new(top_bottom_positions, 3),
                normal: None,
                scale_normal_and_cap: Some(FloatAttribute::new(scale_normal_and_cap, 4)),
                batch_id: None,
            },
            indices: top_bottom_indices,
        },
        wall_geometry: PolygonGeometry {
            attributes: PolygonGeometryAttributes {
                position: FloatAttribute::new(wall_positions, 3),
                normal: None,
                scale_normal_and_cap: Some(FloatAttribute::new(wall_scale_normal_and_cap, 4)),
                batch_id: None,
            },
            indices: wall_indices,
        },
    }
}

// Ref: https://github.com/CesiumGS/cesium/blob/baaabaa49058067c855ad050be73a9cdfe9b6ac7/packages/engine/Source/Core/PolygonGeometry.js#L62
fn compute_extruded_normals(
    ellipsoid: Ellipsoid<FloatType>,
    geometry: &PolygonGeometry,
    wall: bool,
) -> Vec<f32> {
    let positions = &geometry.attributes.position.data;
    let positions_length = positions.len();
    let mut normals = vec![0.; positions_length];

    let mut is_in_corner = true;

    let bottom_offset = positions_length / 2;
    for i in 0..(bottom_offset / 3) {
        let i: usize = i * 3;
        let p0 = unpack_flatten_vec3(positions, i);
        let mut normal = Vec3::ZERO;
        if wall {
            if i + 3 < bottom_offset {
                let mut p1 = unpack_flatten_vec3(positions, i + 3);
                if is_in_corner {
                    let mut bottom_p = unpack_flatten_vec3(positions, i + bottom_offset);
                    p1 -= p0;
                    bottom_p -= p0;
                    normal = bottom_p.cross(p1).normalize();
                    is_in_corner = false;
                }
                if p0.equal_diff_epsilon(p1, EPSILON10) {
                    is_in_corner = true;
                }
            }
        } else {
            normal = Into::<Vec3>::into(ellipsoid.geodetic_surface_normal_from_vec3(p0.into()))
                .normalize();
        }

        let i0 = i;
        let i1 = i0 + 1;
        let i2 = i0 + 2;

        if wall {
            normals[i0 + bottom_offset] = normal.x;
            normals[i1 + bottom_offset] = normal.y;
            normals[i2 + bottom_offset] = normal.z;
        } else {
            normals[i0 + bottom_offset] = -normal.x;
            normals[i1 + bottom_offset] = -normal.y;
            normals[i2 + bottom_offset] = -normal.z;
        }

        normals[i0] = normal.x;
        normals[i1] = normal.y;
        normals[i2] = normal.z;
    }

    normals
}
