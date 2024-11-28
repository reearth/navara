mod clip;

use std::collections::HashMap;

use clip::{clip_2d_triangle_at_threshold, ClippedIndex};
use itertools::Itertools;
use radians::{Angle, Radians};

use navara_core::{lerp, Ellipsoid, Extent, Meters, TileRegion, LLE};

use crate::Geometry;

use navara_math::FloatType;

#[derive(Debug)]
pub struct UpsamplableTerrainGeometry<'a> {
    pub uvs: &'a [FloatType],
    pub heights: &'a [FloatType],
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
    pub heights: Option<Vec<FloatType>>,
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

    /// You can run this function only once.
    pub fn construct_geometry(
        &mut self,
        ellipsoid: Ellipsoid<FloatType>,
        extent: &Extent<FloatType, Radians>,
    ) -> (Geometry, Vec<FloatType>) {
        let mut vertices = vec![];
        let mut uvs = vec![];

        let (min_u, max_u) = if self.is_east { (0.5, 1.) } else { (0., 0.5) };
        let (min_v, max_v) = if self.is_north { (0.5, 1.) } else { (0., 0.5) };

        let offset_u = if self.is_east { 1. } else { 0. };
        let offset_v = if self.is_north { 1. } else { 0. };

        fn clamp_uv(v: FloatType, min: FloatType, max: FloatType, offset: FloatType) -> FloatType {
            if v > max {
                return max;
            }
            if v < min {
                return min;
            }
            v * 2. - offset
        }

        let heights = self.heights.take().unwrap();

        for (i, uv) in self.uvs.take().unwrap().chunks(2).enumerate() {
            let u = clamp_uv(uv[0], min_u, max_u, offset_u);
            let v = clamp_uv(uv[1], min_v, max_v, offset_v);
            let lle = LLE {
                lng: Angle::new(lerp(extent.west.val(), extent.east.val(), u)),
                lat: Angle::new(lerp(extent.south.val(), extent.north.val(), v)),
                height: Meters::new(heights[i]),
            };
            let xyz = lle.to_xyz(ellipsoid);
            vertices.push(xyz.x.val());
            vertices.push(xyz.y.val());
            vertices.push(xyz.z.val());

            uvs.push(u);
            uvs.push(v);
        }

        (
            Geometry {
                vertices,
                uvs,
                indices: self.indices.take().unwrap(),
            },
            heights,
        )
    }
}

// TODO: Execute this function in worker
fn clip(
    uvs: &[FloatType],
    heights: &[FloatType],
    indices: &[u32],
    is_east: bool,
    is_north: bool,
) -> (
    Vec<FloatType>,
    Vec<FloatType>,
    Vec<u32>,
    FloatType,
    FloatType,
) {
    let threashold = 0.5;

    let mut clipped_coord_map = ClippedCoordMap::new();

    let mut new_uvs = vec![];
    let mut new_heights = vec![];
    let mut new_indices = vec![];

    let max_height = 0.0f32;
    let min_height = 99999.0f32;

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

        let origin_u_coords = [u0, u1, u2];
        let origin_v_coords = [v0, v1, v2];
        let origin_h_coords = [h0, h1, h2];

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
        if clipped_u_indices.is_empty() {
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
            (max_height, min_height),
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
            if clipped_u_indices.is_empty() {
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
                (max_height, min_height),
            );
        }
    }

    (new_uvs, new_heights, new_indices, max_height, min_height)
}

fn construct_polygon(
    clipped_indices: &[ClippedIndex],
    new_uvs: &mut Vec<FloatType>,
    new_heights: &mut Vec<FloatType>,
    new_indices: &mut Vec<u32>,
    [interpolated_u_coords, interpolated_v_coords, interpolated_h_coords]: [[FloatType; 3]; 3],
    clipped_coord_map: &mut ClippedCoordMap,
    (mut max_height, mut min_height): (FloatType, FloatType),
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
            new_heights.push(h);

            new_index
        };

        max_height = max_height.max(h);
        min_height = min_height.min(h);

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
struct ClippedCoordMap(HashMap<String, usize>);

impl ClippedCoordMap {
    const SCALE_U16: FloatType = 32767.;

    fn new() -> Self {
        Self(HashMap::new())
    }
    fn get(&mut self, u: FloatType, v: FloatType, h: FloatType) -> Option<&usize> {
        self.0.get(&self.make_key(u, v, h))
    }
    fn insert(&mut self, u: FloatType, v: FloatType, h: FloatType, idx: usize) {
        self.0.insert(self.make_key(u, v, h), idx);
    }
    fn make_key(&self, u: FloatType, v: FloatType, h: FloatType) -> String {
        format!(
            "{}{}{}",
            self.quantize_float(u),
            self.quantize_float(v),
            self.quantize_float(h)
        )
    }
    fn quantize_float(&self, v: FloatType) -> u16 {
        (v * Self::SCALE_U16) as u16
    }
}

#[cfg(test)]
mod test {
    use navara_core::TileRegion;

    use crate::UpsamplableTerrainGeometry;

    use super::UpsampledTerrainGeometry;

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

        assert_eq!(
            mesh.uvs.unwrap(),
            [0.8, 0.9, 0.5, 0.85714287, 0.5, 0.5, 0.57142854, 0.5]
        );
        assert_eq!(
            mesh.heights.unwrap(),
            [100.0, 57.14286, 61.111115, 71.42857]
        );
        assert_eq!(mesh.indices.unwrap(), [0, 1, 2, 0, 2, 3]);

        let mesh = UpsampledTerrainGeometry::new(
            UpsamplableTerrainGeometry {
                uvs: &[0., 1., 0., 0., 1., 0., 1., 1.],
                heights: &[0., 50., 100., 50.],
                indices: &[0, 1, 2, 0, 2, 3],
            },
            &TileRegion::NorthEast,
        );

        assert_eq!(
            mesh.uvs.unwrap(),
            [0.5, 0.5, 1.0, 1.0, 0.5, 1.0, 0.75, 0.5, 1.0, 0.5]
        );
        assert_eq!(mesh.heights.unwrap(), [50.0, 50.0, 25.0, 62.5, 75.0]);
        assert_eq!(mesh.indices.unwrap(), [1, 2, 3, 1, 3, 4, 2, 0, 3]);
    }
}
