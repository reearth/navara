use navara_core::{Ellipsoid, CRS, WGS84_32};
use navara_math::{EqualEpsilon, FloatType, Vec2, Vec3, EPSILON10, RADIANS_PER_DEGREE};

use crate::{helpers::vec::unpack_flatten_vec3, FloatAttribute};

use super::{
    helpers::{
        compute_wall_geometry, create_geometry_from_positions, polygons_from_hierarchy,
        project_to_2d, scale_to_geodetic_height_extruded,
    },
    types::Polygon,
    HierarchyVec3, PolygonGeometryAttributes, PolygonResource, WindingOrder,
};

#[derive(Clone, Debug, Default, PartialEq)]
pub struct PolygonGeometry {
    pub attributes: PolygonGeometryAttributes,
    pub indices: Vec<u32>,
}

pub struct PolygonGeometryOptions {
    pub hierarchy: HierarchyVec3,
    pub granularity: f32,
    pub crs: CRS,
    pub clamp_to_ground: bool,
    pub extruded_height: f32,
    pub height: f32,
}

impl Default for PolygonGeometryOptions {
    fn default() -> Self {
        Self {
            hierarchy: HierarchyVec3 {
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

/// Creates a flat polygon geometry from a polygon hierarchy in Cartesian coordinates.
/// This function assumes the polygon is on a flat plane, not on an ellipsoid.
pub fn create_flat_polygon_geometry(
    options: PolygonGeometryOptions,
    polygon_resource: &mut PolygonResource,
) -> Option<PolygonGeometryResult> {
    let polygon_hierarchy = &options.hierarchy;

    let outer_positions = &polygon_hierarchy.outer_ring;
    if outer_positions.len() < 3 {
        return None;
    }

    // Simple projection for Cartesian coordinates - just extract x and y
    let project_to_cartesian_2d = |positions: &[Vec3]| -> Vec<Vec2> {
        positions.iter().map(|p| Vec2::new(p.x, p.y)).collect()
    };

    let (polygons, _) = polygons_from_hierarchy(polygon_hierarchy, project_to_cartesian_2d);

    if polygons.is_empty() {
        return None;
    }

    let mut combined_positions = vec![];
    let mut combined_indices = vec![];
    let mut index_offset = 0;

    // Process each polygon
    for polygon in &polygons {
        // Get triangulation indices using earcut
        let polygon_indices = polygon_resource.earcut(polygon);
        if polygon_indices.len() < 3 {
            continue;
        }

        // Add positions to the combined buffer
        let positions_len = combined_positions.len() / 3;
        for position in &polygon.positions {
            combined_positions.push(position.x);
            combined_positions.push(position.y);
            combined_positions.push(position.z);
        }

        // Adjust and add indices to the combined buffer
        if index_offset > 0 {
            for idx in polygon_indices {
                combined_indices.push((idx + positions_len) as u32);
            }
        } else {
            for idx in polygon_indices {
                combined_indices.push(idx as u32);
            }
        }

        index_offset = combined_positions.len() as u32 / 3;
    }

    if combined_indices.is_empty() {
        return None;
    }

    // Create the final geometry with only position attribute
    let combined_attributes = PolygonGeometryAttributes {
        position: FloatAttribute::new(combined_positions, 3),
        normal: None,
        scale_normal_and_cap: None,
        batch_id_and_sel: None,
        batch_index: None,
    };

    Some(PolygonGeometryResult {
        geometry: PolygonGeometry {
            attributes: combined_attributes,
            indices: combined_indices,
        },
    })
}

// Ref: https://github.com/CesiumGS/cesium/blob/baaabaa49058067c855ad050be73a9cdfe9b6ac7/packages/engine/Source/Core/PolygonGeometry.js#L1278
pub fn create_polygon_geometry(
    options: PolygonGeometryOptions,
    polygon_resource: &mut PolygonResource,
) -> Option<PolygonGeometryResult> {
    let granularity = options.granularity;
    let polygon_hierarchy = &options.hierarchy;
    let clamp_to_ground = options.clamp_to_ground;

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

        if !clamp_to_ground {
            let top_bottom_normals =
                compute_extruded_normals(WGS84_32, &split_geometry.top_bottom_geometry, false);
            split_geometry.top_bottom_geometry.attributes.normal =
                Some(FloatAttribute::new(top_bottom_normals, 3));
        }
        geometries.push(split_geometry.top_bottom_geometry);

        for mut wall_geometry in split_geometry.wall_geometries {
            if !clamp_to_ground {
                let wall_normals = compute_extruded_normals(WGS84_32, &wall_geometry, true);
                wall_geometry.attributes.normal = Some(FloatAttribute::new(wall_normals, 3));
            }
            geometries.push(wall_geometry);
        }
    }

    let mut combined_attributes = PolygonGeometryAttributes {
        position: FloatAttribute::new(vec![], 3),
        normal: None,
        scale_normal_and_cap: Some(FloatAttribute::new(vec![], 4)),
        batch_id_and_sel: None,
        batch_index: None,
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
        if let Some(normal) = geometry.attributes.normal.as_mut() {
            combined_attributes
                .normal
                .get_or_insert_with(|| FloatAttribute::new(vec![], 3))
                .data
                .append(&mut normal.data);
        }
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
    pub wall_geometries: Vec<PolygonGeometry>,
}

// Ref: https://github.com/CesiumGS/cesium/blob/baaabaa49058067c855ad050be73a9cdfe9b6ac7/packages/engine/Source/Core/PolygonGeometry.js#L428
pub fn create_geometry_from_positions_extruded(
    ellipsoid: Ellipsoid<FloatType>,
    polygon_resource: &mut PolygonResource,
    polygon: &Polygon,
    granularity: FloatType,
    hierarchy: &HierarchyVec3,
) -> ExtrudedPolygonGeometry {
    let (mut top_positions, mut top_indices) =
        create_geometry_from_positions(ellipsoid, polygon_resource, polygon, granularity);

    let mut top_bottom_positions = Vec::with_capacity(top_positions.len() * 2);
    top_bottom_positions.append(&mut top_positions);
    top_bottom_positions.extend_from_within(..);

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

    let mut wall_geometries =
        Vec::with_capacity(hierarchy.holes.as_ref().map(|h| h.len()).unwrap_or(0) + 1);

    let (mut wall_positions, wall_indices) =
        compute_wall_geometry(ellipsoid, outer_ring, granularity);

    let wall_scale_normal_and_cap =
        scale_to_geodetic_height_extruded(&mut wall_positions, ellipsoid);

    wall_geometries.push(PolygonGeometry {
        attributes: PolygonGeometryAttributes {
            position: FloatAttribute::new(wall_positions, 3),
            normal: None,
            scale_normal_and_cap: Some(FloatAttribute::new(wall_scale_normal_and_cap, 4)),
            batch_id_and_sel: None,
            batch_index: None,
        },
        indices: wall_indices,
    });

    if let Some(holes_src) = &hierarchy.holes {
        for hole_src in holes_src {
            let (mut hole_wall_pos, hole_wall_i) =
                compute_wall_geometry(ellipsoid, &hole_src.outer_ring, granularity);

            let hole_scale_normal_and_cap =
                scale_to_geodetic_height_extruded(&mut hole_wall_pos, ellipsoid);

            wall_geometries.push(PolygonGeometry {
                attributes: PolygonGeometryAttributes {
                    position: FloatAttribute::new(hole_wall_pos, 3),
                    normal: None,
                    scale_normal_and_cap: Some(FloatAttribute::new(hole_scale_normal_and_cap, 4)),
                    batch_id_and_sel: None,
                    batch_index: None,
                },
                indices: hole_wall_i,
            });
        }
    }

    ExtrudedPolygonGeometry {
        top_bottom_geometry: PolygonGeometry {
            attributes: PolygonGeometryAttributes {
                position: FloatAttribute::new(top_bottom_positions, 3),
                normal: None,
                scale_normal_and_cap: Some(FloatAttribute::new(scale_normal_and_cap, 4)),
                batch_id_and_sel: None,
                batch_index: None,
            },
            indices: top_bottom_indices,
        },
        wall_geometries,
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
    let mut normal = Vec3::ZERO;
    for i in 0..(bottom_offset / 3) {
        let i: usize = i * 3;
        let p0 = unpack_flatten_vec3(positions, i);
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
