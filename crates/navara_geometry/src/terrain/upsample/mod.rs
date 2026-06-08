mod clip;

use rustc_hash::FxHashMap;

use clip::{ClippedIndex, clip_2d_triangle_at_threshold};
use itertools::Itertools;
use radians::{Angle, Radians};

use navara_core::{Ellipsoid, Extent, LLE, Meters, TileRegion, lerp};

use crate::Geometry;

use navara_math::{FloatType, Vec3};

#[derive(Debug)]
pub struct UpsamplableTerrainGeometry<'a> {
    pub uvs: &'a [f32],
    pub heights: &'a [f32],
    pub indices: &'a [u32],
}

/// Upsample a terrain mesh which is one of the four split child tiles.
/// The upsampled mesh have to be same size.
/// | 1 | 2 |  upsample 1  |       |
/// ---------     =>       |   1   |
/// | 3 | 4 |              |       |
#[derive(Debug)]
pub struct UpsampledTerrainGeometry {
    pub uvs: Option<Vec<FloatType>>,
    pub heights: Option<Vec<f32>>,
    pub indices: Option<Vec<u32>>,
    pub max_height: FloatType,
    pub min_height: FloatType,
    is_east: bool,
    is_north: bool,
}

impl UpsampledTerrainGeometry {
    pub fn new(upsamplable_geometry: UpsamplableTerrainGeometry, tile_region: &TileRegion) -> Self {
        let uvs = &upsamplable_geometry.uvs;
        let heights = &upsamplable_geometry.heights;
        let indices = &upsamplable_geometry.indices;

        let (is_east, is_north) = match tile_region {
            TileRegion::NorthEast => (true, true),
            TileRegion::SouthEast => (true, false),
            TileRegion::SouthWest => (false, false),
            TileRegion::NorthWest => (false, true),
        };

        let (new_uvs, new_heights, new_indices, max_height, min_height) =
            clip(uvs, heights, indices, is_east, is_north);

        Self {
            uvs: Some(new_uvs),
            heights: Some(new_heights),
            indices: Some(new_indices),
            max_height,
            min_height,
            is_east,
            is_north,
        }
    }

    /// Construct geometry with optional RTC translation.
    /// You can run this function only once.
    pub fn construct_geometry(
        &mut self,
        ellipsoid: Ellipsoid<FloatType>,
        extent: &Extent<FloatType, Radians>,
        center: &Vec3,
    ) -> (Geometry, Vec<f32>) {
        let mut vertices = vec![];
        let mut uvs = vec![];

        let (min_u, max_u) = if self.is_east { (0.5, 1.) } else { (0., 0.5) };
        let (min_v, max_v) = if self.is_north { (0.5, 1.) } else { (0., 0.5) };

        let offset_u = if self.is_east { 1. } else { 0. };
        let offset_v = if self.is_north { 1. } else { 0. };

        fn clamp_uv(v: FloatType, min: FloatType, max: FloatType, offset: FloatType) -> FloatType {
            v.clamp(min, max) * 2. - offset
        }

        let heights = self.heights.take().unwrap();

        for (i, uv) in self.uvs.take().unwrap().chunks(2).enumerate() {
            let u = clamp_uv(uv[0], min_u, max_u, offset_u);
            let v = clamp_uv(uv[1], min_v, max_v, offset_v);
            let lle = LLE {
                lng: Angle::new(lerp(extent.west.val(), extent.east.val(), u)),
                lat: Angle::new(lerp(extent.south.val(), extent.north.val(), v)),
                height: Meters::new(heights[i] as f64),
            };
            let xyz = lle.to_xyz(ellipsoid);

            vertices.push((xyz.x.val() - center.x) as f32);
            vertices.push((xyz.y.val() - center.y) as f32);
            vertices.push((xyz.z.val() - center.z) as f32);

            uvs.push(u as f32);
            uvs.push(v as f32);
        }

        (
            Geometry {
                vertices,
                uvs,
                indices: self.indices.take().unwrap(),
                ..Default::default()
            },
            heights,
        )
    }
}

// TODO: Execute this function in worker
fn clip(
    uvs: &[f32],
    heights: &[f32],
    indices: &[u32],
    is_east: bool,
    is_north: bool,
) -> (Vec<f64>, Vec<f32>, Vec<u32>, f64, f64) {
    let threashold = 0.5;

    let mut clipped_coord_map = ClippedCoordMap::new();

    let mut new_uvs = vec![];
    let mut new_heights = vec![];
    let mut new_indices = vec![];

    let mut max_height = 0.0;
    let mut min_height = 99999.0;

    for polygon_indices in indices.chunks(3) {
        let [u0, v0] = [
            uvs[polygon_indices[0] as usize * 2],
            uvs[polygon_indices[0] as usize * 2 + 1],
        ];
        let [u1, v1] = [
            uvs[polygon_indices[1] as usize * 2],
            uvs[polygon_indices[1] as usize * 2 + 1],
        ];
        let [u2, v2] = [
            uvs[polygon_indices[2] as usize * 2],
            uvs[polygon_indices[2] as usize * 2 + 1],
        ];

        let h0 = heights[polygon_indices[0] as usize];
        let h1 = heights[polygon_indices[1] as usize];
        let h2 = heights[polygon_indices[2] as usize];

        let origin_u_coords = [u0 as f64, u1 as f64, u2 as f64];
        let origin_v_coords = [v0 as f64, v1 as f64, v2 as f64];
        let origin_h_coords = [h0 as f64, h1 as f64, h2 as f64];

        let clipped_u_indices =
            clip_2d_triangle_at_threshold(threashold, is_east, &origin_u_coords);
        if clipped_u_indices.is_empty() {
            continue;
        }

        let interpolated_u_coords = [
            clipped_u_indices[0].interpolate(&origin_u_coords),
            clipped_u_indices[1].interpolate(&origin_u_coords),
            clipped_u_indices[2].interpolate(&origin_u_coords),
        ];
        let interpolated_v_coords = [
            clipped_u_indices[0].interpolate(&origin_v_coords),
            clipped_u_indices[1].interpolate(&origin_v_coords),
            clipped_u_indices[2].interpolate(&origin_v_coords),
        ];
        let interpolated_h_coords = [
            clipped_u_indices[0].interpolate(&origin_h_coords),
            clipped_u_indices[1].interpolate(&origin_h_coords),
            clipped_u_indices[2].interpolate(&origin_h_coords),
        ];

        let clipped_transformed_v_indices =
            clip_2d_triangle_at_threshold(threashold, is_north, &interpolated_v_coords);
        if clipped_transformed_v_indices.is_empty() {
            continue;
        }

        construct_polygon(
            &clipped_transformed_v_indices,
            &mut new_uvs,
            &mut new_heights,
            &mut new_indices,
            [
                interpolated_u_coords,
                interpolated_v_coords,
                interpolated_h_coords,
            ],
            &mut clipped_coord_map,
            (&mut max_height, &mut min_height),
        );

        if clipped_u_indices.len() == 4 {
            let interpolated_u_coords = [
                interpolated_u_coords[0],
                interpolated_u_coords[2],
                clipped_u_indices[3].interpolate(&origin_u_coords),
            ];
            let interpolated_v_coords = [
                interpolated_v_coords[0],
                interpolated_v_coords[2],
                clipped_u_indices[3].interpolate(&origin_v_coords),
            ];
            let interpolated_h_coords = [
                interpolated_h_coords[0],
                interpolated_h_coords[2],
                clipped_u_indices[3].interpolate(&origin_h_coords),
            ];

            let clipped_transformed_v_indices =
                clip_2d_triangle_at_threshold(threashold, is_north, &interpolated_v_coords);
            if clipped_transformed_v_indices.is_empty() {
                continue;
            }

            construct_polygon(
                &clipped_transformed_v_indices,
                &mut new_uvs,
                &mut new_heights,
                &mut new_indices,
                [
                    interpolated_u_coords,
                    interpolated_v_coords,
                    interpolated_h_coords,
                ],
                &mut clipped_coord_map,
                (&mut max_height, &mut min_height),
            );
        }
    }

    (new_uvs, new_heights, new_indices, max_height, min_height)
}

fn construct_polygon(
    clipped_indices: &[ClippedIndex],
    new_uvs: &mut Vec<FloatType>,
    new_heights: &mut Vec<f32>,
    new_indices: &mut Vec<u32>,
    [
        interpolated_u_coords,
        interpolated_v_coords,
        interpolated_h_coords,
    ]: [[FloatType; 3]; 3],
    clipped_coord_map: &mut ClippedCoordMap,
    (max_height, min_height): (&mut FloatType, &mut FloatType),
) {
    let mut new_polygon_indices = vec![];
    for i in clipped_indices {
        let new_index = new_uvs.len() / 2;
        let u = i.interpolate(&interpolated_u_coords);
        let v = i.interpolate(&interpolated_v_coords);
        let h = i.interpolate(&interpolated_h_coords);

        let new_index = if let Some(index) = clipped_coord_map.get(u, v, h) {
            *index
        } else {
            clipped_coord_map.insert(u, v, h, new_index);

            new_uvs.push(u);
            new_uvs.push(v);
            new_heights.push(h as f32);

            new_index
        };

        *max_height = max_height.max(h);
        *min_height = min_height.min(h);

        new_polygon_indices.push(new_index as u32);
    }

    if new_polygon_indices.iter().unique().count() < 3 {
        return;
    }

    if new_polygon_indices.len() == 3 {
        // A triangle.
        if let Some(v) = construct_indices([
            new_polygon_indices[0],
            new_polygon_indices[1],
            new_polygon_indices[2],
        ]) {
            new_indices.append(&mut v.to_vec());
        };
    } else {
        // Two triangles.
        if let Some(v) = construct_indices([
            new_polygon_indices[0],
            new_polygon_indices[1],
            new_polygon_indices[2],
        ]) {
            new_indices.append(&mut v.to_vec());
        };

        if let Some(v) = construct_indices([
            new_polygon_indices[0],
            new_polygon_indices[2],
            new_polygon_indices[3],
        ]) {
            new_indices.append(&mut v.to_vec());
        };
    }
}

fn construct_indices(idxs: [u32; 3]) -> Option<[u32; 3]> {
    if idxs.iter().unique().count() < 3 {
        None
    } else {
        Some(idxs)
    }
}

// This is used to avoid duplicating a coordinate.
struct ClippedCoordMap(FxHashMap<String, usize>);

impl ClippedCoordMap {
    const SCALE_U16: FloatType = 32767.;

    fn new() -> Self {
        Self(FxHashMap::default())
    }
    fn get(&mut self, u: FloatType, v: FloatType, h: FloatType) -> Option<&usize> {
        self.0.get(&self.make_key(u, v, h))
    }
    fn insert(&mut self, u: FloatType, v: FloatType, h: FloatType, idx: usize) {
        self.0.insert(self.make_key(u, v, h), idx);
    }
    fn make_key(&self, u: FloatType, v: FloatType, h: FloatType) -> String {
        format!(
            "{}_{}_{}",
            self.quantize_float(u),
            self.quantize_float(v),
            h.to_bits()
        )
    }
    fn quantize_float(&self, v: FloatType) -> u16 {
        (v * Self::SCALE_U16) as u16
    }
}

#[cfg(test)]
mod test {
    use approx::assert_abs_diff_eq;
    use navara_core::{Extent, LngLat, Rad, TileRegion, WGS84_64};
    use navara_math::{EPSILON5, Vec3};

    use crate::UpsamplableTerrainGeometry;

    use super::UpsampledTerrainGeometry;

    #[test]
    fn sw_and_se_should_have_different_clipped_uvs() {
        // Same parent mesh, two different u-halves. The clipped UVs (in parent UV
        // space, before clamp_uv) must differ: SW keeps u<=0.5, SE keeps u>=0.5.
        let uvs: Vec<f32> = (0..3)
            .flat_map(|j| (0..3).map(move |i| [(i as f32) * 0.5, (j as f32) * 0.5]))
            .flatten()
            .collect();
        let heights: Vec<f32> = (0..9).map(|i| i as f32 * 100.0).collect();
        let mut indices = Vec::new();
        for j in 0..2u32 {
            for i in 0..2u32 {
                let a = j * 3 + i;
                let b = a + 1;
                let c = a + 3;
                let d = c + 1;
                indices.extend_from_slice(&[a, b, d, a, d, c]);
            }
        }

        let sw = UpsampledTerrainGeometry::new(
            UpsamplableTerrainGeometry {
                uvs: &uvs,
                heights: &heights,
                indices: &indices,
            },
            &TileRegion::SouthWest,
        );
        let se = UpsampledTerrainGeometry::new(
            UpsamplableTerrainGeometry {
                uvs: &uvs,
                heights: &heights,
                indices: &indices,
            },
            &TileRegion::SouthEast,
        );

        let sw_uvs = sw.uvs.as_ref().unwrap();
        let se_uvs = se.uvs.as_ref().unwrap();

        // SW kept u in [0, 0.5]. Every u in SW's clipped output must satisfy u <= 0.5.
        for u in sw_uvs.iter().step_by(2) {
            assert!(
                *u <= 0.5 + 1e-9,
                "SW clip leaked vertex with u={} (should be u<=0.5)",
                u
            );
        }
        // SE kept u in [0.5, 1]. Every u in SE's clipped output must satisfy u >= 0.5.
        for u in se_uvs.iter().step_by(2) {
            assert!(
                *u >= 0.5 - 1e-9,
                "SE clip leaked vertex with u={} (should be u>=0.5)",
                u
            );
        }

        // The two clipped UV sets MUST differ — otherwise SW and SE render identical
        // geometry (the user-visible bug).
        assert_ne!(
            sw_uvs, se_uvs,
            "SW and SE produced identical clipped UVs — u-clip is not working"
        );
    }

    #[test]
    fn grandchild_upsample_clips_to_smaller_quadrant() {
        // Simulate a denser parent mesh (3×3 grid → 8 triangles).
        let mut uvs = Vec::new();
        let mut heights = Vec::new();
        for j in 0..3 {
            for i in 0..3 {
                uvs.push(i as f32 * 0.5);
                uvs.push(j as f32 * 0.5);
                heights.push((i * 10 + j * 100) as f32);
            }
        }
        let mut indices = Vec::new();
        for j in 0..2u32 {
            for i in 0..2u32 {
                let a = j * 3 + i;
                let b = a + 1;
                let c = a + 3;
                let d = c + 1;
                indices.extend_from_slice(&[a, b, d, a, d, c]);
            }
        }

        // First upsample: parent → NE child
        let mut child = UpsampledTerrainGeometry::new(
            UpsamplableTerrainGeometry {
                uvs: &uvs,
                heights: &heights,
                indices: &indices,
            },
            &TileRegion::NorthEast,
        );

        // Run construct_geometry to remap child uvs to child space [0, 1].
        let parent_extent = Extent::from_points(&[
            LngLat {
                lng: Rad::new(2.41887_f64),
                lat: Rad::new(0.61610_f64),
            },
            LngLat {
                lng: Rad::new(2.41922_f64),
                lat: Rad::new(0.61645_f64),
            },
        ]);
        let mid_lng = (parent_extent.west.val() + parent_extent.east.val()) / 2.0;
        let mid_lat = (parent_extent.south.val() + parent_extent.north.val()) / 2.0;
        let child_extent = Extent::from_points(&[
            LngLat {
                lng: Rad::new(mid_lng),
                lat: Rad::new(mid_lat),
            },
            LngLat {
                lng: parent_extent.east,
                lat: parent_extent.north,
            },
        ]);
        let (child_geom, child_heights) =
            child.construct_geometry(WGS84_64, &child_extent, &Vec3::ZERO);

        // Second upsample: child → NE grandchild
        let grandchild = UpsampledTerrainGeometry::new(
            UpsamplableTerrainGeometry {
                uvs: &child_geom.uvs,
                heights: &child_heights,
                indices: &child_geom.indices,
            },
            &TileRegion::NorthEast,
        );

        let clipped_uvs = grandchild.uvs.as_ref().unwrap();
        let clipped_indices = grandchild.indices.as_ref().unwrap();

        // Sanity: clip should produce *fewer* triangles than the child had.
        assert!(
            !clipped_indices.is_empty(),
            "grandchild produced no triangles"
        );

        // All referenced vertices must be in [0.5, 1] x [0.5, 1] of child UV.
        use std::collections::HashSet;
        let referenced: HashSet<u32> = clipped_indices.iter().copied().collect();
        for &idx in &referenced {
            let u = clipped_uvs[idx as usize * 2];
            let v = clipped_uvs[idx as usize * 2 + 1];
            assert!(
                u >= 0.5 - 1e-9 && v >= 0.5 - 1e-9,
                "grandchild referenced vertex {} ({}, {}) outside NE quadrant of child",
                idx,
                u,
                v
            );
        }
    }

    #[test]
    fn it_should_construct_upsampled_coords() {
        let mesh = UpsampledTerrainGeometry::new(
            UpsamplableTerrainGeometry {
                uvs: &[0.1, 0.8, 0.4, 0.2, 0.8, 0.9],
                heights: &[0., 50., 100.],
                indices: &[0, 1, 2],
            },
            &TileRegion::NorthEast,
        );

        fn assert_all_f32(results: &[f32], expects: &[f32]) {
            for (idx, result) in results.iter().enumerate() {
                assert_abs_diff_eq!(*result, expects[idx], epsilon = EPSILON5 as f32);
            }
        }
        fn assert_all_f64(results: &[f64], expects: &[f64]) {
            for (idx, result) in results.iter().enumerate() {
                assert_abs_diff_eq!(*result, expects[idx], epsilon = EPSILON5);
            }
        }

        assert_all_f64(
            &mesh.uvs.unwrap(),
            &[0.8, 0.9, 0.5, 0.85714287, 0.5, 0.5, 0.57142854, 0.5],
        );
        assert_all_f32(
            &mesh.heights.unwrap(),
            &[100.0, 57.14286, 61.111115, 71.42857],
        );
        assert_eq!(&mesh.indices.unwrap(), &[0, 1, 2, 0, 2, 3]);

        let mesh = UpsampledTerrainGeometry::new(
            UpsamplableTerrainGeometry {
                uvs: &[0., 1., 0., 0., 1., 0., 1., 1.],
                heights: &[0., 50., 100., 50.],
                indices: &[0, 1, 2, 0, 2, 3],
            },
            &TileRegion::NorthEast,
        );

        assert_all_f64(
            &mesh.uvs.unwrap(),
            &[0.5, 0.5, 1.0, 1.0, 0.5, 1.0, 0.75, 0.5, 1.0, 0.5],
        );
        assert_all_f32(&mesh.heights.unwrap(), &[50.0, 50.0, 25.0, 62.5, 75.0]);
        assert_eq!(mesh.indices.unwrap(), [1, 2, 3, 1, 3, 4, 2, 0, 3]);
    }
}
