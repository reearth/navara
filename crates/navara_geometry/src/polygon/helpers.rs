use std::collections::{HashMap, VecDeque};

use navara_core::{Ellipsoid, EllipsoidTangentPlane};
use navara_math::{chord_length, EqualEpsilon, FloatType, Vec2, Vec3, EPSILON10};

use crate::helpers::vec::{unique_with_delta_e, unpack_flatten_vec3};

use super::{
    types::{Hierarchy, Polygon},
    PolygonResource, WindingOrder,
};

// Ref: https://github.com/CesiumGS/cesium/blob/6c2e520420b95bcb6c8eba0f02c76347cee1dd4b/packages/engine/Source/Core/PolygonGeometry.js#L1163
pub fn project_to_2d(
    ellipsoid: Ellipsoid<FloatType>,
    outer_positions: &[Vec3],
) -> impl Fn(&[Vec3]) -> Vec<Vec2> {
    // TODO: Add a logic for a large extent polygon: https://github.com/CesiumGS/cesium/blob/6c2e520420b95bcb6c8eba0f02c76347cee1dd4b/packages/engine/Source/Core/PolygonGeometry.js#L1165-L1189
    let tangent_plane = EllipsoidTangentPlane::from_points(outer_positions, ellipsoid);
    move |p| tangent_plane.project_points_onto_plane(p)
}

// Ref: https://github.com/CesiumGS/cesium/blob/6c2e520420b95bcb6c8eba0f02c76347cee1dd4b/packages/engine/Source/Core/PolygonGeometryLibrary.js#L753
pub fn polygons_from_hierarchy<F>(
    polygon_hierarchy: &Hierarchy,
    project_points_to_2d: F,
) -> (Vec<Polygon>, Vec<Hierarchy>)
where
    F: Fn(&[Vec3]) -> Vec<Vec2>,
{
    let mut polygons: Vec<Polygon> = vec![];
    let mut hierarchies: Vec<Hierarchy> = vec![];

    let mut queue = VecDeque::new();
    queue.push_back(polygon_hierarchy);

    while let Some(outer_node) = queue.pop_front() {
        let outer_ring = &outer_node.outer_ring;

        let outer_ring = unique_with_delta_e(outer_ring, 10);
        if outer_ring.len() < 3 {
            continue;
        }

        let mut positions = outer_ring.clone();
        let mut hole_indices =
            Vec::with_capacity(outer_node.holes.as_ref().map_or(0, |holes| holes.len()));
        let mut holes_dst = Vec::with_capacity(hole_indices.capacity());

        if let Some(holes_src) = &outer_node.holes {
            for hole_src in holes_src {
                let hole_dst: Vec<_> = unique_with_delta_e(&hole_src.outer_ring, 10);
                if hole_dst.len() > 2 {
                    let index = positions.len() as u32;
                    hole_indices.push(index);
                    positions.extend(hole_dst.iter());

                    holes_dst.push(Hierarchy {
                        outer_ring: hole_dst,
                        holes: None,
                        expected_winding_order: WindingOrder::Clockwise,
                    });
                }
            }
        }

        let positions_2d = project_points_to_2d(&positions);
        if positions_2d.is_empty() {
            continue;
        }

        polygons.push(Polygon {
            positions,
            positions_2d,
            hole_indices,
        });
        hierarchies.push(Hierarchy {
            outer_ring,
            holes: (!holes_dst.is_empty()).then_some(holes_dst),
            expected_winding_order: WindingOrder::CounterClockwise,
        })
    }

    (polygons, hierarchies)
}

pub fn create_geometry_from_positions(
    ellipsoid: Ellipsoid<FloatType>,
    polygon_resource: &mut PolygonResource,
    polygon: &Polygon,
    granularity: FloatType,
) -> (Vec<FloatType>, Vec<u32>) {
    let mut indices = polygon_resource.earcut(polygon);
    if indices.len() < 3 {
        indices = vec![0, 1, 2];
    }

    // TODO: Support RHUMB arc type.
    // For geodesic arc type
    compute_subdivision(ellipsoid, &polygon.positions, indices, granularity)
}

// Ref: https://github.com/CesiumGS/cesium/blob/6c2e520420b95bcb6c8eba0f02c76347cee1dd4b/packages/engine/Source/Core/PolygonGeometryLibrary.js#L358
pub fn scale_to_geodetic_height_extruded(
    positions: &mut [f32],
    ellipsoid: Ellipsoid<FloatType>,
) -> Vec<f32> {
    let length = positions.len() / 2;

    let scale_normals_offset = length / 3 * 4;
    let mut scale_normals_and_cap = vec![0.; scale_normals_offset * 2];

    for i in 0..(length / 3) {
        let i3 = i * 3;
        let i4 = i * 4;
        let p = unpack_flatten_vec3(positions, i3);

        let n1 =
            Into::<Vec3>::into(ellipsoid.geodetic_surface_normal_from_vec3(p.into())).normalize();
        let p2 = match ellipsoid.scale_to_geodetic_surface(p) {
            Some(p2) => p2,
            None => unreachable!(),
        };

        positions[i3 + length] = p2.x as f32;
        positions[i3 + 1 + length] = p2.y as f32;
        positions[i3 + 2 + length] = p2.z as f32;

        positions[i3] = p2.x as f32;
        positions[i3 + 1] = p2.y as f32;
        positions[i3 + 2] = p2.z as f32;

        scale_normals_and_cap[i4 + scale_normals_offset] = n1.x as f32;
        scale_normals_and_cap[i4 + 1 + scale_normals_offset] = n1.y as f32;
        scale_normals_and_cap[i4 + 2 + scale_normals_offset] = n1.z as f32;
        scale_normals_and_cap[i4 + 3 + scale_normals_offset] = 0.;

        scale_normals_and_cap[i4] = n1.x as f32;
        scale_normals_and_cap[i4 + 1] = n1.y as f32;
        scale_normals_and_cap[i4 + 2] = n1.z as f32;
        scale_normals_and_cap[i4 + 3] = 1.;
    }

    scale_normals_and_cap
}

// Ref: https://github.com/CesiumGS/cesium/blob/6c2e520420b95bcb6c8eba0f02c76347cee1dd4b/packages/engine/Source/Core/PolygonPipeline.js#L102
pub fn compute_subdivision(
    ellipsoid: Ellipsoid<FloatType>,
    positions: &[Vec3],
    indices: Vec<u32>,
    granularity: FloatType,
) -> (Vec<FloatType>, Vec<u32>) {
    let radius = ellipsoid.semi_major_axis();
    let min_distance = chord_length(granularity, radius);
    let min_distance_sqrt = min_distance * min_distance;

    let mut edges: HashMap<(usize, usize), usize> = HashMap::new();

    let mut subdivided_indices = vec![];
    let mut subdivided_positions = positions
        .iter()
        .flat_map(|p| [p.x, p.y, p.z])
        .collect::<Vec<_>>();

    let mut triangles = indices;

    let mut make_triangle = |triangles: &mut Vec<u32>,
                             subdivided_positions: &mut Vec<FloatType>,
                             ia: usize,
                             ib: usize,
                             ic: usize,
                             va: Vec3,
                             vb: Vec3| {
        let min = ia.min(ib);
        let max = ia.max(ib);
        let edge_key = (min, max);
        let i = match edges.get(&edge_key) {
            Some(i) => *i,
            None => {
                let mid = (va + vb) * 0.5;
                subdivided_positions.append(&mut vec![mid.x, mid.y, mid.z]);
                let i = subdivided_positions.len() / 3 - 1;
                edges.insert(edge_key, i);
                i
            }
        };
        triangles.append(&mut vec![ia as u32, i as u32, ic as u32]);
        triangles.append(&mut vec![i as u32, ib as u32, ic as u32]);
    };

    while let Some(i2) = triangles.pop() {
        let i2 = i2 as usize;
        let i1 = triangles.pop().unwrap() as usize;
        let i0 = triangles.pop().unwrap() as usize;

        let v0 = unpack_flatten_vec3(&subdivided_positions, i0 * 3);
        let v1 = unpack_flatten_vec3(&subdivided_positions, i1 * 3);
        let v2 = unpack_flatten_vec3(&subdivided_positions, i2 * 3);

        let s0 = v0.normalize() * radius;
        let s1 = v1.normalize() * radius;
        let s2 = v2.normalize() * radius;

        let g0 = (s0 - s1).length_squared();
        let g1 = (s1 - s2).length_squared();
        let g2 = (s2 - s0).length_squared();

        let max = g0.max(g1).max(g2);

        if max <= min_distance_sqrt {
            subdivided_indices.push(i0 as u32);
            subdivided_indices.push(i1 as u32);
            subdivided_indices.push(i2 as u32);
            continue;
        }

        match max {
            v if g0 == v => make_triangle(
                &mut triangles,
                &mut subdivided_positions,
                i0,
                i1,
                i2,
                v0,
                v1,
            ),
            v if g1 == v => make_triangle(
                &mut triangles,
                &mut subdivided_positions,
                i1,
                i2,
                i0,
                v1,
                v2,
            ),
            v if g2 == v => make_triangle(
                &mut triangles,
                &mut subdivided_positions,
                i2,
                i0,
                i1,
                v2,
                v0,
            ),
            _ => {}
        }
    }

    (subdivided_positions, subdivided_indices)
}

// Ref: https://github.com/CesiumGS/cesium/blob/6c2e520420b95bcb6c8eba0f02c76347cee1dd4b/packages/engine/Source/Core/PolygonGeometryLibrary.js#L1029
pub fn compute_wall_geometry(
    ellipsoid: Ellipsoid<FloatType>,
    positions: &[Vec3],
    granularity: FloatType,
) -> (Vec<f32>, Vec<u32>) {
    let length = positions.len();
    let min_distance = chord_length(granularity, ellipsoid.semi_major_axis());

    let mut num_vertices = 0;

    for i in 0..length {
        num_vertices +=
            subdivide_line_count(positions[i], positions[(i + 1) % length], min_distance);
    }

    let top_edge_length = (num_vertices as usize + length) * 3;
    let mut edge_positions = vec![0.; top_edge_length * 2];

    let mut edge_index = 0;
    for i in 0..length {
        let p1 = positions[i];
        let p2 = positions[(i + 1) % length];

        // For geodesic arc type
        let subdivided_positions = subdivide_line(p1, p2, min_distance);

        for pos in subdivided_positions {
            edge_positions[edge_index] = pos;
            edge_positions[edge_index + top_edge_length] = pos;
            edge_index += 1;
        }

        edge_positions[edge_index] = p2.x;
        edge_positions[edge_index + top_edge_length] = p2.x;
        edge_index += 1;
        edge_positions[edge_index] = p2.y;
        edge_positions[edge_index + top_edge_length] = p2.y;
        edge_index += 1;
        edge_positions[edge_index] = p2.z;
        edge_positions[edge_index + top_edge_length] = p2.z;
        edge_index += 1;
    }

    let edge_positions_length = edge_positions.len();
    let mut indices = vec![];
    let length = edge_positions_length / 6;

    for i in 0..length {
        let ul = i as u32;
        let ur = ul + 1;
        let ll = ul + length as u32;
        let lr = ll + 1;

        let p1 = unpack_flatten_vec3(&edge_positions, (ul * 3) as usize);
        let p2 = unpack_flatten_vec3(&edge_positions, (ur * 3) as usize);
        if p1.equal_diff_epsilon(p2, EPSILON10) {
            // skip corner
            continue;
        }

        indices.push(ul);
        indices.push(ll);
        indices.push(ur);
        indices.push(ur);
        indices.push(ll);
        indices.push(lr);
    }

    (edge_positions, indices)
}

fn subdivide_line_count(p0: Vec3, p1: Vec3, min_distance: FloatType) -> u32 {
    let distance = p0.distance(p1);
    let n = distance / min_distance;
    let count_divide = n.log2().ceil().max(0.);
    2.0f32.powf(count_divide) as u32
}

fn get_point_at_distance(p0: Vec3, p1: Vec3, distance: f32, length: f32) -> Vec3 {
    let mut next_p = p1 - p0;
    next_p *= distance / length;
    next_p = p0 + next_p;
    next_p
}

/// Subdivide line by the given minimum distance.
fn subdivide_line(p0: Vec3, p1: Vec3, min_distance: FloatType) -> Vec<f32> {
    let num_vertices = subdivide_line_count(p0, p1, min_distance);
    let length = p0.distance(p1);
    let distance_between_vertices = length / num_vertices as f32;

    let mut positions = vec![];
    for i in 0..num_vertices {
        let p = get_point_at_distance(p0, p1, i as f32 * distance_between_vertices, length);
        positions.push(p.x);
        positions.push(p.y);
        positions.push(p.z);
    }

    positions
}

#[cfg(test)]
mod test {
    use navara_core::WGS84_32;
    use navara_math::{Vec3, RADIANS_PER_DEGREE};

    use super::compute_subdivision;

    #[test]
    fn it_should_be_non_subdivision_polygon() {
        let positions = &[
            Vec3::new(0.0, 0.0, 90.0),
            Vec3::new(0.0, 90.0, 0.0),
            Vec3::new(90.0, 0.0, 0.0),
        ];
        let indices = vec![0, 1, 2];
        let subdivision = compute_subdivision(WGS84_32, positions, indices, 60.);

        assert_eq!(subdivision.0[0], 0.0);
        assert_eq!(subdivision.0[1], 0.0);
        assert_eq!(subdivision.0[2], 90.0);
        assert_eq!(subdivision.0[3], 0.0);
        assert_eq!(subdivision.0[4], 90.0);
        assert_eq!(subdivision.0[5], 0.0);
        assert_eq!(subdivision.0[6], 90.0);
        assert_eq!(subdivision.0[7], 0.0);
        assert_eq!(subdivision.0[8], 0.0);

        assert_eq!(subdivision.1[0], 0);
        assert_eq!(subdivision.1[1], 1);
        assert_eq!(subdivision.1[2], 2);
    }

    #[test]
    fn it_should_be_subdivided_polygon() {
        let positions = &[
            Vec3::new(6377802.759444977, -58_441.305, 29_025.648),
            Vec3::new(6377802.759444977, -58_441.305, -29_025.648),
            Vec3::new(6378137., 0., 0.),
            Vec3::new(6377802.759444977, 58_441.305, -29_025.648),
            Vec3::new(6377802.759444977, 58_441.305, 29_025.648),
        ];
        let indices = vec![0, 1, 2, 2, 3, 4, 4, 0, 2];
        let subdivision = compute_subdivision(WGS84_32, positions, indices, RADIANS_PER_DEGREE);

        assert_eq!(subdivision.0[0], 6377802.759444977);
        assert_eq!(subdivision.0[1], -58_441.305);
        assert_eq!(subdivision.0[2], 29_025.648);
        assert_eq!(subdivision.0[3], 6377802.759444977);
        assert_eq!(subdivision.0[4], -58_441.305);
        assert_eq!(subdivision.0[5], -29_025.648);
        assert_eq!(subdivision.0[6], 6378137.0);
        assert_eq!(subdivision.0[7], 0.0);
        assert_eq!(subdivision.0[8], 0.0);
        assert_eq!(subdivision.0[9], 6377802.759444977);
        assert_eq!(subdivision.0[10], 58_441.305);
        assert_eq!(subdivision.0[11], -29_025.648);
        assert_eq!(subdivision.0[12], 6377802.759444977);
        assert_eq!(subdivision.0[13], 58_441.305);
        assert_eq!(subdivision.0[14], 29_025.648);
        assert_eq!(subdivision.0[15], 6377802.759444977);
        assert_eq!(subdivision.0[16], 0.0);
        assert_eq!(subdivision.0[17], 29_025.648);

        assert_eq!(subdivision.1[0], 5);
        assert_eq!(subdivision.1[1], 0);
        assert_eq!(subdivision.1[2], 2);
        assert_eq!(subdivision.1[3], 4);
        assert_eq!(subdivision.1[4], 5);
        assert_eq!(subdivision.1[5], 2);
        assert_eq!(subdivision.1[6], 2);
        assert_eq!(subdivision.1[7], 3);
        assert_eq!(subdivision.1[8], 4);
        assert_eq!(subdivision.1[9], 0);
        assert_eq!(subdivision.1[10], 1);
        assert_eq!(subdivision.1[11], 2);
    }
}
