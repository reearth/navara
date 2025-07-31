use core::f32;

use navara_core::{xyz_to_vec3, EllipsoidGeodesic, Extent, Meters, Radians, CRS, LLE, WGS84_32};
use navara_geometry::{
    create_flat_polygon_geometry, create_polygon_geometry, FloatAttribute, Hierarchy,
    HierarchyVec3, PolygonGeometryOptions, PolygonGeometryResult, PolygonOutlineGeometry,
    PolygonResource, WindingOrder,
};
use navara_material::PolygonMaterial;
use navara_math::{FloatType, Vec3};

fn interpolate_ring_segments(one_ring: &[f32], height: FloatType) -> Vec<Vec3> {
    let granularity = 9999.0;
    let mut positions = vec![];
    for i in 0..(one_ring.len() / 3 - 1) {
        let pi = i * 3;
        let v1 = Vec3::new(one_ring[pi], one_ring[pi + 1], one_ring[pi + 2]);
        let v2 = Vec3::new(one_ring[pi + 3], one_ring[pi + 4], one_ring[pi + 5]);

        let start = LLE::from_float(v1.x, v1.y, height).rad();
        let end = LLE::from_float(v2.x, v2.y, height).rad();

        let ellipsoid_line = EllipsoidGeodesic::new(start, end, &WGS84_32);
        let segments = (ellipsoid_line.distance / granularity).ceil() as usize;
        if segments > 1 {
            let interpoint_distance = ellipsoid_line.distance / segments as f32;
            for j in 0..segments {
                let mut point =
                    ellipsoid_line.interpolate_distance(&WGS84_32, j as f32 * interpoint_distance);
                point.height = Meters::new(height);
                let world_pos = xyz_to_vec3(WGS84_32.lle_to_xyz(point));
                positions.push(world_pos);
            }
        } else {
            let world_pos = xyz_to_vec3(WGS84_32.lle_to_xyz(start));
            positions.push(world_pos);
        }

        if i == one_ring.len() / 3 - 2 {
            let world_pos = xyz_to_vec3(WGS84_32.lle_to_xyz(end));
            positions.push(world_pos);
        }
    }

    positions
}

fn get_outline_top_down(
    geometry_hierarchy: &Hierarchy,
    height: FloatType,
    outline_positions: &mut Vec<Vec3>,
) {
    let ring = &(geometry_hierarchy.outer_ring);
    let positions = interpolate_ring_segments(ring, height);
    if !positions.is_empty() {
        outline_positions.extend(positions);
        outline_positions.push(Vec3::new(f32::NAN, f32::NAN, f32::NAN)); // Add a NaN to separate the outlines
    }

    if let Some(holes) = &(geometry_hierarchy.holes) {
        for hole in holes {
            let ring = &(hole.outer_ring);
            let positions = interpolate_ring_segments(ring, height);
            if !positions.is_empty() {
                outline_positions.extend(positions);
                outline_positions.push(Vec3::new(f32::NAN, f32::NAN, f32::NAN));
                // Add a NaN to separate the outlines
            }
        }
    }
}

fn get_side_outline(ring: &[f32], height: FloatType, outline_positions: &mut Vec<Vec3>) {
    for i in 0..(ring.len() / 3 - 1) {
        let pi = i * 3;
        let v = Vec3::new(ring[pi], ring[pi + 1], ring[pi + 2]);

        let v1 = LLE::from_float(v.x, v.y, 0.0).rad();
        let v2 = LLE::from_float(v.x, v.y, height).rad();

        let world_pos1 = xyz_to_vec3(WGS84_32.lle_to_xyz(v1));
        let world_pos2 = xyz_to_vec3(WGS84_32.lle_to_xyz(v2));

        outline_positions.push(world_pos1);
        outline_positions.push(world_pos2);
        outline_positions.push(Vec3::new(f32::NAN, f32::NAN, f32::NAN)); // Add a NaN to separate the outlines
    }
}

pub fn create_outline_geometry(
    geometry_hierarchy: &Hierarchy,
    height: Option<FloatType>,
) -> PolygonOutlineGeometry {
    let mut outline_positions = vec![];

    get_outline_top_down(geometry_hierarchy, 0.0, &mut outline_positions);
    if let Some(height) = height {
        get_outline_top_down(geometry_hierarchy, height, &mut outline_positions);

        let outer_ring = &(geometry_hierarchy.outer_ring);
        get_side_outline(outer_ring, height, &mut outline_positions);

        if let Some(holes) = &(geometry_hierarchy.holes) {
            for hole in holes {
                let ring = &(hole.outer_ring);
                get_side_outline(ring, height, &mut outline_positions);
            }
        }
    }

    PolygonOutlineGeometry {
        position: FloatAttribute::new(
            outline_positions
                .iter()
                .flat_map(|v| v.to_array())
                .collect(),
            3,
        ),
    }
}

pub fn construct_polygon_feature(
    geometry_hierarchy: Hierarchy,
    crs: &CRS,
    material: &PolygonMaterial,
    polygon_resource: &mut PolygonResource,
) -> (Option<Extent<f32, Radians>>, Option<PolygonGeometryResult>) {
    let mut lnglats = vec![];

    let mut hierarchy = HierarchyVec3 {
        expected_winding_order: geometry_hierarchy.expected_winding_order,
        ..Default::default()
    };
    let ring: Vec<f32> = geometry_hierarchy.outer_ring;
    for i in 0..(ring.len() / 3) {
        let i = i * 3;
        let v = Vec3::new(ring[i], ring[i + 1], ring[i + 2]);
        hierarchy
            .outer_ring
            .push(crs.to_vec3(WGS84_32, v, material.height));
        lnglats.push(crs.to_lng_lat(WGS84_32, v));
    }

    if let Some(holes_before) = &geometry_hierarchy.holes {
        hierarchy.holes = Some(
            holes_before
                .iter()
                .map(|hole| {
                    let ring = &hole.outer_ring;
                    let mut outer_ring = vec![];
                    for i in 0..(ring.len() / 3) {
                        let i = i * 3;
                        outer_ring.push(crs.to_vec3(
                            WGS84_32,
                            Vec3::new(ring[i], ring[i + 1], ring[i + 2]),
                            material.height,
                        ));
                    }
                    HierarchyVec3 {
                        outer_ring,
                        holes: None,
                        expected_winding_order: geometry_hierarchy.expected_winding_order,
                    }
                })
                .collect(),
        );
    }

    hierarchy.align_winding_order();

    if hierarchy.expected_winding_order == WindingOrder::Unknown {
        // If all the vertices of a polygon lie on a single line, the winding order becomes WindingOrder::Unknown.
        // Such a polygon should be discarded.
        return (None, None);
    }

    let extent = Extent::from_points(&lnglats);

    let polygon_result = create_polygon_geometry(
        PolygonGeometryOptions {
            hierarchy,
            clamp_to_ground: material.clamp_to_ground,
            height: material.height,
            extruded_height: material.extruded_height.unwrap_or_default(),
            ..Default::default()
        },
        polygon_resource,
    );

    (Some(extent), polygon_result)
}

pub fn construct_flat_polygon_feature(
    geometry_hierarchy: Hierarchy,
    material: &PolygonMaterial,
    polygon_resource: &mut PolygonResource,
) -> Option<PolygonGeometryResult> {
    let mut hierarchy = HierarchyVec3 {
        expected_winding_order: geometry_hierarchy.expected_winding_order,
        ..Default::default()
    };
    let ring = geometry_hierarchy.outer_ring;
    for i in 0..(ring.len() / 3) {
        let i = i * 3;
        let v = Vec3::new(ring[i], ring[i + 1], ring[i + 2]);
        hierarchy.outer_ring.push(v);
    }

    if let Some(holes_before) = &geometry_hierarchy.holes {
        hierarchy.holes = Some(
            holes_before
                .iter()
                .map(|hole| {
                    let ring = &hole.outer_ring;
                    let mut outer_ring = vec![];
                    for i in 0..(ring.len() / 3) {
                        let i = i * 3;
                        outer_ring.push(Vec3::new(ring[i], ring[i + 1], ring[i + 2]));
                    }
                    HierarchyVec3 {
                        outer_ring,
                        holes: None,
                        expected_winding_order: geometry_hierarchy.expected_winding_order,
                    }
                })
                .collect(),
        );
    }

    hierarchy.align_winding_order();

    if hierarchy.expected_winding_order == WindingOrder::Unknown {
        // If all the vertices of a polygon lie on a single line, the winding order becomes WindingOrder::Unknown.
        // Such a polygon should be discarded.
        return None;
    }

    create_flat_polygon_geometry(
        PolygonGeometryOptions {
            hierarchy,
            clamp_to_ground: material.clamp_to_ground,
            height: material.height,
            extruded_height: material.extruded_height.unwrap_or_default(),
            ..Default::default()
        },
        polygon_resource,
    )
}
