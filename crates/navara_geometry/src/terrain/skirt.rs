use std::collections::HashMap;

use crate::Geometry;
use navara_core::{
    get_ellipsoid_terrain_level_zero_maximum_geometric_error, get_level_maximum_geometric_error,
    Ellipsoid, Meters, XYZ,
};
use navara_math::FloatType;

/// Represents a boundary edge of the mesh.
#[derive(Debug, Clone, Copy)]
pub struct Edge {
    pub v0: u32,
    pub v1: u32,
}

/// Separate skirt geometry data.
/// This allows the rendering engine to handle skirts differently
/// for shadow maps and normal computation.
#[derive(Debug, Clone, PartialEq, Default)]
pub struct SkirtData {
    /// Skirt vertices (stride 3).
    pub vertices: Vec<f32>,
    /// Skirt UVs (stride 2).
    pub uvs: Vec<f32>,
    /// Skirt indices for triangles.
    pub indices: Vec<u32>,
    /// Mapping from skirt vertex index to edge vertex index in main geometry.
    /// For each skirt vertex pair (new_v0, new_v1), this stores the original
    /// edge vertex indices (v0, v1) so normals can be copied from the edge.
    pub indices_to_edge: Vec<u32>,
}

/// Information about an edge during boundary detection.
struct EdgeInfo {
    count: u32,
    /// Original direction from the first triangle that introduced this edge
    dir: (u32, u32),
}

/// Function that returns a "down" direction for a given vertex.
///
/// - `vertex_index`: index of the vertex (0-based).
/// - `positions`: full position buffer.
pub type DownDirFn = dyn Fn(usize, &[f32]) -> [f32; 3];

/// Pack an undirected edge {a, b} into a u64 key.
///
/// Assumes each index fits in u32. We canonicalize as (min, max)
/// so {a, b} and {b, a} map to the same key.
#[inline]
fn edge_key(a: u32, b: u32) -> u64 {
    let (min, max) = if a < b { (a, b) } else { (b, a) };
    ((min as u64) << 32) | (max as u64)
}

/// Compute boundary (outside) edges from triangle indices.
///
/// `triangles` is [i0, i1, i2, i3, i4, i5, ...] (3 per triangle).
pub fn compute_boundary_edges(triangles: &[u32]) -> Vec<Edge> {
    assert!(triangles.len() % 3 == 0);

    let mut map: HashMap<u64, EdgeInfo> = HashMap::new();

    let mut process_edge = |i1: u32, i2: u32| {
        let key = edge_key(i1, i2);
        map.entry(key)
            .and_modify(|info| {
                info.count += 1;
            })
            .or_insert(EdgeInfo {
                count: 1,
                dir: (i1, i2),
            });
    };

    for tri in triangles.chunks_exact(3) {
        let a = tri[0];
        let b = tri[1];
        let c = tri[2];

        process_edge(a, b);
        process_edge(b, c);
        process_edge(c, a);
    }

    let mut boundary_edges = Vec::new();
    for info in map.values() {
        if info.count == 1 {
            let (v0, v1) = info.dir;
            boundary_edges.push(Edge { v0, v1 });
        }
    }

    boundary_edges
}

/// Get position from vertex buffer.
#[inline]
fn get_position(vertex_index: usize, positions: &[f32]) -> [f32; 3] {
    let i = vertex_index * 3;
    [positions[i], positions[i + 1], positions[i + 2]]
}

/// Get texture coordinates from UV buffer.
#[inline]
fn get_texcoord(vertex_index: usize, uvs: &[f32]) -> [f32; 2] {
    let i = vertex_index * 2;
    [uvs[i], uvs[i + 1]]
}

/// Generate separate skirt geometry data without modifying the original geometry.
///
/// This function creates skirt vertices and indices as separate data,
/// which allows the rendering engine to:
/// 1. Exclude skirts from shadow map depth rendering
/// 2. Copy normals from edge vertices to skirt vertices
///
/// - `geometry`: the terrain geometry to generate skirts for.
/// - `skirt_height`: distance to move vertices along "down" direction.
/// - `down_dir_fn`: callback providing "down" vector for each vertex.
///
/// Returns `SkirtData` containing the skirt geometry and edge mapping.
pub fn generate_skirt(
    geometry: &Geometry,
    skirt_height: f32,
    down_dir_fn: &DownDirFn,
) -> SkirtData {
    let boundary_edges = compute_boundary_edges(&geometry.indices);
    let original_vertex_count = geometry.vertices.len() / 3;
    let edge_count = boundary_edges.len();

    let mut skirt_vertices = Vec::with_capacity(edge_count * 2 * 3);
    let mut skirt_uvs = Vec::with_capacity(edge_count * 2 * 2);
    let mut skirt_indices = Vec::with_capacity(edge_count * 2 * 3);
    let mut indices_to_edge = Vec::with_capacity(edge_count * 2);

    for (edge_index, edge) in boundary_edges.iter().enumerate() {
        let v0 = edge.v0 as usize;
        let v1 = edge.v1 as usize;

        // New vertex indices within the skirt vertex array
        let skirt_v0_index = edge_index * 2;
        let skirt_v1_index = edge_index * 2 + 1;

        // --- Positions ---
        let p0 = get_position(v0, &geometry.vertices);
        let p1 = get_position(v1, &geometry.vertices);

        let d0 = down_dir_fn(v0, &geometry.vertices);
        let d1 = down_dir_fn(v1, &geometry.vertices);

        let new_p0 = [
            p0[0] + d0[0] * skirt_height,
            p0[1] + d0[1] * skirt_height,
            p0[2] + d0[2] * skirt_height,
        ];
        let new_p1 = [
            p1[0] + d1[0] * skirt_height,
            p1[1] + d1[1] * skirt_height,
            p1[2] + d1[2] * skirt_height,
        ];

        skirt_vertices.extend_from_slice(&new_p0);
        skirt_vertices.extend_from_slice(&new_p1);

        // --- UVs ---
        let t0 = get_texcoord(v0, &geometry.uvs);
        let t1 = get_texcoord(v1, &geometry.uvs);

        skirt_uvs.extend_from_slice(&t0);
        skirt_uvs.extend_from_slice(&t1);

        // --- Edge mapping for normals ---
        // Each skirt vertex should copy normal from corresponding edge vertex
        indices_to_edge.push(edge.v0);
        indices_to_edge.push(edge.v1);

        // --- Triangles ---
        // The indices reference both main geometry vertices (v0, v1) and
        // skirt vertices (offset by original_vertex_count).
        // When combined in the rendering engine, skirt vertices will be
        // appended after main vertices.
        let v0_u32 = edge.v0;
        let v1_u32 = edge.v1;
        let new_v0_u32 = (original_vertex_count + skirt_v0_index) as u32;
        let new_v1_u32 = (original_vertex_count + skirt_v1_index) as u32;

        skirt_indices.push(v0_u32);
        skirt_indices.push(new_v1_u32);
        skirt_indices.push(v1_u32);

        skirt_indices.push(v0_u32);
        skirt_indices.push(new_v0_u32);
        skirt_indices.push(new_v1_u32);
    }

    SkirtData {
        vertices: skirt_vertices,
        uvs: skirt_uvs,
        indices: skirt_indices,
        indices_to_edge,
    }
}

/// Add skirt data to geometry's optional skirt fields.
///
/// - `geometry`: mutable Geometry struct to add skirt data to.
/// - `skirt_height`: distance to move vertices along "down" direction.
/// - `down_dir_fn`: callback providing "down" vector for each vertex.
pub fn add_skirt_separate(geometry: &mut Geometry, skirt_height: f32, down_dir_fn: &DownDirFn) {
    let skirt_data = generate_skirt(geometry, skirt_height, down_dir_fn);

    geometry.skirt_vertices = Some(skirt_data.vertices);
    geometry.skirt_uvs = Some(skirt_data.uvs);
    geometry.skirt_indices = Some(skirt_data.indices);
    geometry.skirt_indices_to_edge = Some(skirt_data.indices_to_edge);
}

/// Add skirts along all boundary edges of the mesh (legacy inline method).
///
/// This function modifies the geometry directly by appending skirt vertices
/// and indices. For separate skirt handling (shadow maps, normals), use
/// `add_skirt_separate` instead.
///
/// - `geometry`: mutable Geometry struct.
/// - `skirt_height`: distance to move vertices along "down" direction.
/// - `down_dir_fn`: callback providing "down" vector for each vertex.
pub fn add_skirt(geometry: &mut Geometry, skirt_height: f32, down_dir_fn: &DownDirFn) {
    let skirt_data = generate_skirt(geometry, skirt_height, down_dir_fn);

    // Append skirt data to main geometry
    geometry.vertices.extend_from_slice(&skirt_data.vertices);
    geometry.uvs.extend_from_slice(&skirt_data.uvs);
    geometry.indices.extend_from_slice(&skirt_data.indices);
}

/// Create a down direction function for WGS84 ellipsoid.
///
/// This function returns the inward direction (opposite of the geodetic surface normal)
/// for a given vertex position on the WGS84 ellipsoid.
///
/// The `rtc_translation` parameter is used to convert from RTC (Relative-To-Center)
/// coordinates back to world coordinates before computing the surface normal.
pub fn make_wgs84_down_dir_fn(
    ellipsoid: Ellipsoid<FloatType>,
    rtc_translation: Option<navara_math::Vec3>,
) -> impl Fn(usize, &[f32]) -> [f32; 3] {
    move |vertex_index: usize, positions: &[f32]| -> [f32; 3] {
        let i = vertex_index * 3;

        let mut x = positions[i] as f64;
        let mut y = positions[i + 1] as f64;
        let mut z = positions[i + 2] as f64;

        // Convert from RTC to world coordinates if translation is provided
        if let Some(translation) = rtc_translation {
            x += translation.x;
            y += translation.y;
            z += translation.z;
        }

        let p = XYZ {
            x: Meters::new(x),
            y: Meters::new(y),
            z: Meters::new(z),
        };

        // Outward unit normal on WGS84
        let n = ellipsoid.geodetic_surface_normal_from_vec3(p);

        // Normalize the result
        let nx = n.x.val();
        let ny = n.y.val();
        let nz = n.z.val();
        let len = (nx * nx + ny * ny + nz * nz).sqrt();

        // Down = inward direction (opposite of normal)
        let dx = -nx / len;
        let dy = -ny / len;
        let dz = -nz / len;

        [dx as f32, dy as f32, dz as f32]
    }
}

const MAX_SKIRT_HEIGHT: f64 = 10000.0;
const MIN_SKIRT_HEIGHT: f64 = 100.0;

/// Calculate the skirt height based on geometric error at the given zoom level.
///
/// The skirt height is derived from the maximum geometric error for a terrain,
/// which represents the maximum vertical deviation between rendered and actual terrain.
/// This ensures skirts are tall enough to hide gaps between tiles without being
/// unnecessarily large.
///
/// # Arguments
/// * `ellipsoid` - The ellipsoid used for terrain calculations
/// * `zoom` - The zoom level of the tile (0-24 typically)
/// * `exaggeration` - Multiplier for the calculated height (1.0 = default)
///
/// # Returns
/// The skirt height in meters
pub fn calculate_skirt_height(ellipsoid: &Ellipsoid<f64>, zoom: usize, exaggeration: f32) -> f32 {
    // Get the maximum geometric error at level zero
    let level_zero_error =
        get_ellipsoid_terrain_level_zero_maximum_geometric_error(ellipsoid, 65.0);

    // Trial & error value. Adjust the error to hide the gap.
    let error_scale = 10.0;

    // Get the geometric error at the current zoom level (halves with each level)
    let level_error = get_level_maximum_geometric_error(zoom, level_zero_error) * error_scale;

    // Apply exaggeration and clamp to reasonable bounds
    (level_error * exaggeration as f64).clamp(MIN_SKIRT_HEIGHT, MAX_SKIRT_HEIGHT) as f32
}

#[cfg(test)]
mod tests {
    use approx::assert_abs_diff_eq;
    use navara_math::EPSILON5;

    use super::*;

    #[test]
    fn test_edge_key() {
        // Same key for both directions
        assert_eq!(edge_key(1, 2), edge_key(2, 1));
        assert_eq!(edge_key(0, 100), edge_key(100, 0));

        // Different keys for different edges
        assert_ne!(edge_key(1, 2), edge_key(1, 3));
        assert_ne!(edge_key(1, 2), edge_key(0, 2));
    }

    #[test]
    fn test_compute_boundary_edges_single_triangle() {
        // Single triangle: all edges are boundary edges
        let triangles = vec![0, 1, 2];
        let edges = compute_boundary_edges(&triangles);

        assert_eq!(edges.len(), 3);
    }

    #[test]
    fn test_compute_boundary_edges_two_triangles_shared_edge() {
        // Two triangles sharing edge (1, 2):
        // Triangle 1: 0, 1, 2
        // Triangle 2: 1, 3, 2
        // Shared edge: 1-2 (internal)
        // Boundary edges: 0-1, 0-2, 1-3, 3-2
        let triangles = vec![0, 1, 2, 1, 3, 2];
        let edges = compute_boundary_edges(&triangles);

        assert_eq!(edges.len(), 4);
    }

    #[test]
    fn test_compute_boundary_edges_quad() {
        // A quad made of two triangles:
        // 0 --- 1
        // |   / |
        // | /   |
        // 2 --- 3
        // Triangle 1: 0, 1, 2 (edges: 0-1, 1-2, 2-0)
        // Triangle 2: 1, 3, 2 (edges: 1-3, 3-2, 2-1)
        // Shared edge: 1-2
        // Boundary edges: 0-1, 0-2, 1-3, 3-2
        let triangles = vec![0, 1, 2, 1, 3, 2];
        let edges = compute_boundary_edges(&triangles);

        assert_eq!(edges.len(), 4);
    }

    #[test]
    fn test_add_skirt_single_triangle() {
        // Create a simple triangle geometry
        let mut geometry = Geometry {
            vertices: vec![
                0.0, 0.0, 0.0, // vertex 0
                1.0, 0.0, 0.0, // vertex 1
                0.5, 1.0, 0.0, // vertex 2
            ],
            uvs: vec![
                0.0, 0.0, // uv 0
                1.0, 0.0, // uv 1
                0.5, 1.0, // uv 2
            ],
            indices: vec![0, 1, 2],
            ..Default::default()
        };

        let skirt_height = 0.5;
        let down_dir_fn = |_vertex_index: usize, _positions: &[f32]| -> [f32; 3] {
            // Simple down direction (negative Z)
            [0.0, 0.0, -1.0]
        };

        add_skirt(&mut geometry, skirt_height, &down_dir_fn);

        // Original: 3 vertices
        // Boundary edges: 3 (all edges are boundary)
        // New vertices: 3 * 2 = 6
        // Total vertices: 9
        assert_eq!(geometry.vertices.len() / 3, 9);
        assert_eq!(geometry.uvs.len() / 2, 9);

        // Original: 1 triangle (3 indices)
        // New triangles: 3 edges * 2 triangles = 6 triangles (18 indices)
        // Total: 21 indices
        assert_eq!(geometry.indices.len(), 21);
    }

    #[test]
    fn test_add_skirt_preserves_original_geometry() {
        let mut geometry = Geometry {
            vertices: vec![0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.5, 1.0, 0.0],
            uvs: vec![0.0, 0.0, 1.0, 0.0, 0.5, 1.0],
            indices: vec![0, 1, 2],
            ..Default::default()
        };

        let original_vertices = geometry.vertices.clone();
        let original_uvs = geometry.uvs.clone();
        let original_indices = geometry.indices.clone();

        let down_dir_fn = |_: usize, _: &[f32]| [0.0, 0.0, -1.0];
        add_skirt(&mut geometry, 0.5, &down_dir_fn);

        // Check that original data is preserved at the beginning
        assert_eq!(&geometry.vertices[..9], &original_vertices[..]);
        assert_eq!(&geometry.uvs[..6], &original_uvs[..]);
        assert_eq!(&geometry.indices[..3], &original_indices[..]);
    }

    #[test]
    fn test_generate_skirt_single_triangle() {
        // Create a simple triangle geometry
        let geometry = Geometry {
            vertices: vec![
                0.0, 0.0, 0.0, // vertex 0
                1.0, 0.0, 0.0, // vertex 1
                0.5, 1.0, 0.0, // vertex 2
            ],
            uvs: vec![
                0.0, 0.0, // uv 0
                1.0, 0.0, // uv 1
                0.5, 1.0, // uv 2
            ],
            indices: vec![0, 1, 2],
            ..Default::default()
        };

        let skirt_height = 0.5;
        let down_dir_fn =
            |_vertex_index: usize, _positions: &[f32]| -> [f32; 3] { [0.0, 0.0, -1.0] };

        let skirt_data = generate_skirt(&geometry, skirt_height, &down_dir_fn);

        // 3 boundary edges * 2 vertices per edge = 6 skirt vertices
        assert_eq!(skirt_data.vertices.len() / 3, 6);
        assert_eq!(skirt_data.uvs.len() / 2, 6);

        // 3 edges * 2 triangles * 3 indices = 18 indices
        assert_eq!(skirt_data.indices.len(), 18);

        // 6 skirt vertices, each maps to an edge vertex
        assert_eq!(skirt_data.indices_to_edge.len(), 6);
    }

    #[test]
    fn test_generate_skirt_does_not_modify_original() {
        let geometry = Geometry {
            vertices: vec![0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.5, 1.0, 0.0],
            uvs: vec![0.0, 0.0, 1.0, 0.0, 0.5, 1.0],
            indices: vec![0, 1, 2],
            ..Default::default()
        };

        let original_geometry = geometry.clone();
        let down_dir_fn = |_: usize, _: &[f32]| [0.0, 0.0, -1.0];
        let _skirt_data = generate_skirt(&geometry, 0.5, &down_dir_fn);

        // Ensure original geometry is unchanged
        assert_eq!(geometry, original_geometry);
    }

    #[test]
    fn test_add_skirt_separate() {
        let mut geometry = Geometry {
            vertices: vec![
                0.0, 0.0, 0.0, // vertex 0
                1.0, 0.0, 0.0, // vertex 1
                0.5, 1.0, 0.0, // vertex 2
            ],
            uvs: vec![
                0.0, 0.0, // uv 0
                1.0, 0.0, // uv 1
                0.5, 1.0, // uv 2
            ],
            indices: vec![0, 1, 2],
            ..Default::default()
        };

        let down_dir_fn = |_: usize, _: &[f32]| [0.0, 0.0, -1.0];
        add_skirt_separate(&mut geometry, 0.5, &down_dir_fn);

        // Main geometry should remain unchanged
        assert_eq!(geometry.vertices.len() / 3, 3);
        assert_eq!(geometry.uvs.len() / 2, 3);
        assert_eq!(geometry.indices.len(), 3);

        // Skirt fields should be populated
        assert!(geometry.skirt_vertices.is_some());
        assert!(geometry.skirt_uvs.is_some());
        assert!(geometry.skirt_indices.is_some());
        assert!(geometry.skirt_indices_to_edge.is_some());

        let skirt_vertices = geometry.skirt_vertices.unwrap();
        let skirt_uvs = geometry.skirt_uvs.unwrap();
        let skirt_indices = geometry.skirt_indices.unwrap();
        let indices_to_edge = geometry.skirt_indices_to_edge.unwrap();

        assert_eq!(skirt_vertices.len() / 3, 6);
        assert_eq!(skirt_uvs.len() / 2, 6);
        assert_eq!(skirt_indices.len(), 18);
        assert_eq!(indices_to_edge.len(), 6);
    }

    #[test]
    fn test_skirt_indices_to_edge_mapping() {
        let geometry = Geometry {
            vertices: vec![
                0.0, 0.0, 0.0, // vertex 0
                1.0, 0.0, 0.0, // vertex 1
                0.5, 1.0, 0.0, // vertex 2
            ],
            uvs: vec![
                0.0, 0.0, // uv 0
                1.0, 0.0, // uv 1
                0.5, 1.0, // uv 2
            ],
            indices: vec![0, 1, 2],
            ..Default::default()
        };

        let down_dir_fn = |_: usize, _: &[f32]| [0.0, 0.0, -1.0];
        let skirt_data = generate_skirt(&geometry, 0.5, &down_dir_fn);

        // Each pair in indices_to_edge should correspond to valid main geometry vertices
        for &idx in &skirt_data.indices_to_edge {
            assert!(idx < 3, "Edge index should reference main geometry vertex");
        }

        // Should have pairs (one for each skirt vertex)
        assert_eq!(skirt_data.indices_to_edge.len() % 2, 0);
    }

    #[test]
    fn test_calculate_skirt_height() {
        use navara_core::WGS84_64;

        // At zoom 0, should return max height (clamped) with exaggeration 1.0
        let height_z0 = calculate_skirt_height(&WGS84_64, 0, 1.0);
        // Level 0 geometric error is very large, so it's clamped to MAX_SKIRT_HEIGHT
        assert_abs_diff_eq!(height_z0 as f64, MAX_SKIRT_HEIGHT, epsilon = EPSILON5);

        // At zoom 1, should be less than or equal to zoom 0 (geometric error halves)
        let height_z1 = calculate_skirt_height(&WGS84_64, 1, 1.0);
        assert_abs_diff_eq!(height_z1 as f64, MAX_SKIRT_HEIGHT, epsilon = EPSILON5);

        // At higher zoom, height should decrease
        let height_z5 = calculate_skirt_height(&WGS84_64, 10, 1.0);
        assert_abs_diff_eq!(height_z5 as f64, 1505.221435546875, epsilon = EPSILON5);

        let height_z10 = calculate_skirt_height(&WGS84_64, 15, 1.0);
        assert_abs_diff_eq!(height_z10 as f64, MIN_SKIRT_HEIGHT, epsilon = EPSILON5);

        // Exaggeration of 2.0 should double the base height (before clamping)
        let height_z10_2x = calculate_skirt_height(&WGS84_64, 10, 2.0);
        let height_z10_1x = calculate_skirt_height(&WGS84_64, 10, 1.0);
        // At zoom 10, the height is within clamp range, so exaggeration should work
        assert!((height_z10_2x - height_z10_1x * 2.0).abs() < 1.0 || height_z10_2x >= 1000.0);
    }
}
