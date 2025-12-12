use crate::Geometry;
use navara_core::{Aabb, Ellipsoid, Extent, Meters, Radians, TileXYZ, LLE};
use navara_math::{FloatType, Vec2, Vec3};

/// Represents a UV transformation for mapping a child tile to its parent's texture space.
/// This is used when a child tile is not yet loaded and we want to display the parent's
/// texture in the child's area.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct TileUvTransform {
    /// The offset of the child tile in the parent's UV space (top-left corner)
    pub offset: Vec2,
    /// The scale factor to apply to the child's UVs to map to the parent's texture
    pub scale: Vec2,
}

impl Default for TileUvTransform {
    fn default() -> Self {
        Self {
            offset: Vec2::ZERO,
            scale: Vec2::ONE,
        }
    }
}

/// Calculates the UV transformation needed to map a child tile to its parent's texture space.
///
/// When a child tile is not yet loaded, we can use the parent's texture as a temporary
/// placeholder. This function calculates the offset and scale needed to correctly map
/// the child tile's UV coordinates to the appropriate region in the parent's texture.
///
/// # Arguments
///
/// * `child` - The child tile coordinates
/// * `parent_z` - The zoom level of the parent tile
///
/// # Returns
///
/// A `TileUvTransform` containing the offset and scale to apply to the child's UVs
///
/// # Panics
///
/// Panics if the child's zoom level is less than the parent's zoom level
pub fn uv_transform(child: TileXYZ, parent_z: usize) -> TileUvTransform {
    let TileXYZ {
        z: z_c,
        x: x_c,
        y: y_c,
    } = child;
    assert!(
        z_c >= parent_z,
        "child must be deeper than or equal to parent"
    );

    let dz = z_c - parent_z; // Level difference
    let div = 1u32 << dz; // Parent divided into 2^dz parts
    let rel_x = x_c as u32 % div; // Relative x position within parent
    let rel_y = div - 1 - (y_c as u32 % div); // Relative y position within parent (origin=bottom-left)

    let s = 1.0 / div as f64;
    TileUvTransform {
        offset: Vec2::new(rel_x as f64 * s, rel_y as f64 * s),
        scale: Vec2::splat(s),
    }
}

/// OrthographicCamera transformation values to align with child tile region
#[derive(Debug, Clone, Copy)]
pub struct OrthoCamTransform {
    pub left: f32,
    pub right: f32,
    pub top: f32,
    pub bottom: f32,
}

/// Returns the projection parameters for an OrthographicCamera
/// to align with the sub-region occupied by `child` in parent tile space.
///
/// * Parent tile coordinates are x,y ∈ [-1, +1] ... width=2, height=2
/// * XYZ coordinate system (origin at top-left) is used.
///
/// This function calculates the parameters needed to zoom an orthographic camera
/// to a specific subtile within a parent tile. The camera will be positioned
/// so that the subtile fills the entire view.
pub fn ortho_camera_transform(child: TileXYZ, parent_z: usize) -> OrthoCamTransform {
    let TileXYZ {
        z: z_c,
        x: x_c,
        y: y_c,
    } = child;
    assert!(z_c >= parent_z, "child must be deeper than parent");

    let dz = z_c - parent_z; // Level difference
    let div = 1u32 << dz; // Parent divided into 2^dz parts

    // Calculate the relative position of the child tile within the parent
    let rel_x = x_c as u32 % div; // Relative x index within parent
    let rel_y = y_c as u32 % div; // Relative y index within parent

    // Calculate the size of each subtile
    let full_min = -1.0;
    let full_max = 1.0;
    let half_size = (full_max - full_min) / div as f32;

    // Calculate the boundaries of the subtile
    // For XYZ coordinate system (origin at top-left), we need to adjust the y-coordinate
    // In XYZ, y increases downward, but in the camera space, y increases upward
    let left = full_min + rel_x as f32 * half_size;
    let right = left + half_size;

    // For y-coordinate, we need to invert the y-axis
    // In XYZ, (0,0) is top-left, but in the example, iy=0 is bottom and iy=1 is top
    // So we need to flip the y-coordinate
    let iy = div - 1 - rel_y; // Convert from XYZ (top-left origin) to example coordinates (bottom-left origin)
    let bottom = full_min + iy as f32 * half_size;
    let top = bottom + half_size;

    OrthoCamTransform {
        left,
        right,
        top,
        bottom,
    }
}

/// Construct a flat tile geometry with RTC translation.
/// Returns a tuple of (Geometry, RTC translation vector).
/// Vertices in the geometry are in local space relative to the RTC center.
pub fn tile_triangles_flat(
    ellipsoid: Ellipsoid<FloatType>,
    extent: &Extent<FloatType, Radians>,
    segments: usize,
    height: FloatType,
) -> (Geometry, Vec3) {
    let aabb = Aabb::from_extent_f64(*extent, 0., 0.);
    let tile_center = aabb.center;

    // Generate geometry directly in local RTC space
    let geometry = tile_triangles(
        ellipsoid,
        extent,
        segments,
        &mut |_, _| height,
        &tile_center,
    );

    (geometry, tile_center)
}

/// Calculate a tile geometry with optional RTC translation.
pub(crate) fn tile_triangles<F: FnMut(usize, usize) -> FloatType>(
    ellipsoid: Ellipsoid<FloatType>,
    extent: &Extent<FloatType, Radians>,
    segments: usize,
    height: &mut F,
    center: &Vec3,
) -> Geometry {
    let segments = if segments == 0 { 1 } else { segments };

    let vertices_count = (segments + 1) * (segments + 1);
    let mut vertices = Vec::with_capacity(vertices_count);
    let mut uvs = Vec::with_capacity(vertices_count);
    let mut indices = Vec::with_capacity(segments * segments * 6);

    let dlng = (extent.east - extent.west) / segments as FloatType;
    let dlat = (extent.north - extent.south) / segments as FloatType;

    for i in 0..=segments {
        for j in 0..=segments {
            let lle = LLE {
                lng: extent.west + dlng * i as FloatType,
                lat: extent.south + dlat * j as FloatType,
                height: Meters::new(height(i, j)),
            };
            let xyz = lle.to_xyz(ellipsoid);

            vertices.push((xyz.x.val() - center.x) as f32);
            vertices.push((xyz.y.val() - center.y) as f32);
            vertices.push((xyz.z.val() - center.z) as f32);

            uvs.push(i as f32 / segments as f32);
            uvs.push(j as f32 / segments as f32);

            if i != segments && j != segments {
                let a = i * (segments + 1) + j;
                let b = (i + 1) * (segments + 1) + j;
                let c = b + 1;
                let d = a + 1;

                indices.push(a as u32);
                indices.push(b as u32);
                indices.push(d as u32);
                indices.push(b as u32);
                indices.push(c as u32);
                indices.push(d as u32);
            }
        }
    }

    Geometry {
        vertices,
        uvs,
        indices,
        ..Default::default()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use approx::assert_relative_eq;

    // Case 1: Parent and child at the same level
    #[test]
    fn identity() {
        let tf = uv_transform(
            TileXYZ {
                z: 10,
                x: 512,
                y: 300,
            },
            10,
        );
        assert_relative_eq!(tf.offset.x, 0.0, epsilon = 1e-6);
        assert_relative_eq!(tf.offset.y, 0.0, epsilon = 1e-6);
        assert_relative_eq!(tf.scale.x, 1.0, epsilon = 1e-6);
        assert_relative_eq!(tf.scale.y, 1.0, epsilon = 1e-6);
    }

    // Case 2: Child one level down (top-right quadrant)
    #[test]
    fn one_level_down() {
        let tf = uv_transform(TileXYZ { z: 4, x: 1, y: 0 }, 3);
        assert_relative_eq!(tf.offset.x, 0.5, epsilon = 1e-6);
        assert_relative_eq!(tf.offset.y, 0.5, epsilon = 1e-6);
        assert_relative_eq!(tf.scale.x, 0.5, epsilon = 1e-6);
        assert_relative_eq!(tf.scale.y, 0.5, epsilon = 1e-6);
    }

    // Case 3: Child two levels down at arbitrary coordinates
    #[test]
    fn two_levels_down() {
        let tf = uv_transform(
            TileXYZ {
                z: 12,
                x: 1365,
                y: 1030,
            },
            10,
        );
        assert_relative_eq!(tf.offset.x, 0.25, epsilon = 1e-6);
        assert_relative_eq!(tf.offset.y, 0.25, epsilon = 1e-6);
        assert_relative_eq!(tf.scale.x, 0.25, epsilon = 1e-6);
        assert_relative_eq!(tf.scale.y, 0.25, epsilon = 1e-6);
    }

    // Tests for ortho_camera_transform

    #[test] // Parent and child at same level
    fn ortho_cam_identity() {
        let t = ortho_camera_transform(TileXYZ { z: 10, x: 5, y: 3 }, 10);
        // When parent and child are at the same level, the camera should view the entire parent tile
        assert_relative_eq!(t.left, -1.0, epsilon = 1e-6);
        assert_relative_eq!(t.right, 1.0, epsilon = 1e-6);
        assert_relative_eq!(t.top, 1.0, epsilon = 1e-6);
        assert_relative_eq!(t.bottom, -1.0, epsilon = 1e-6);
    }

    #[test] // Parent divided into 2×2, top-right quadrant (x=1, y=1)
    fn ortho_cam_quadrant() {
        let t = ortho_camera_transform(TileXYZ { z: 4, x: 1, y: 1 }, 3);
        // For a child at (1, 1) one level down from parent (div=2), we expect:
        // ix=1 (right), iy=0 (bottom) in the example's coordinate system
        // This corresponds to the top-right quadrant in XYZ coordinates
        assert_relative_eq!(t.left, 0.0, epsilon = 1e-6);
        assert_relative_eq!(t.right, 1.0, epsilon = 1e-6);
        assert_relative_eq!(t.top, 0.0, epsilon = 1e-6);
        assert_relative_eq!(t.bottom, -1.0, epsilon = 1e-6);
    }

    #[test] // 2 levels down (div=4), arbitrary example
    fn ortho_cam_two_levels() {
        let t = ortho_camera_transform(
            TileXYZ {
                z: 12,
                x: 1365,
                y: 1030,
            },
            10,
        );

        // Expected values based on the JavaScript example:
        // left = -1 + 1 * 0.5 = -0.5
        // right = left + 0.5 = 0.0
        // bottom = -1 + 1 * 0.5 = -0.5
        // top = bottom + 0.5 = 0.0
        assert_relative_eq!(t.left, -0.5, epsilon = 1e-6);
        assert_relative_eq!(t.right, 0.0, epsilon = 1e-6);
        assert_relative_eq!(t.top, 0.0, epsilon = 1e-6);
        assert_relative_eq!(t.bottom, -0.5, epsilon = 1e-6);
    }
}
