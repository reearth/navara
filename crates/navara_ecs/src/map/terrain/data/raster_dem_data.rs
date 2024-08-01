use bevy_ecs::entity::Entity;
use martini::Martini;
use navara_core::{
    terrain::ElevationDecoder, Ellipsoid, Extent, LngLat, Meters, Radians, TileRegion, LLE, XYZ,
};
use navara_geometry::{
    decode_height_from_dem, tile_triangles_with_terrain, Geometry, UpsampledTerrainGeometry,
};

use crate::{map::tile::Tile, BufferStore, Handle};

use super::TerrainData;

#[derive(Debug, Default)]
pub struct RasterDEMData {
    pub decoder: ElevationDecoder,
    pub(crate) data_requester_entity_id: Option<Entity>,
    // Indicates the max height of the terrain from the globe surface.
    pub(crate) current_max_height: Option<f32>,
    pub(crate) heights_handle: Option<Handle>,
}

impl TerrainData for RasterDEMData {
    fn data_requester_entity_id(&self) -> Option<Entity> {
        self.data_requester_entity_id
    }

    fn set_data_requester_entity_id(&mut self, e: Option<Entity>) {
        self.data_requester_entity_id = e;
    }

    fn compute_height_at_point(
        &mut self,
        extent: &Extent<f32, Radians>,
        buf: &mut BufferStore,
        terrain_data_requesters: &bevy_ecs::system::Query<(
            &crate::map::tile::terrain::TerrainDataRequesterMarker,
            &crate::DataRequester,
        )>,
        point: &navara_core::LngLat<f32, navara_core::Radians>,
    ) -> Option<f32> {
        let heights = if let Some(handle) = &self.heights_handle {
            buf.get_f32(handle)?
        } else {
            let (_, data_requester) = terrain_data_requesters
                .get(self.data_requester_entity_id()?)
                .ok()?;
            let bytes = buf.get_u8(&data_requester.handle)?;
            let size = ((bytes.len() / 4) as f64).sqrt() as usize;

            let mut result = vec![];
            for y in (0..size).rev() {
                for x in 0..size {
                    let i = y * size + x;

                    let k = i * 4;
                    let r = bytes[k] as i64;
                    let g = bytes[k + 1] as i64;
                    let b = bytes[k + 2] as i64;

                    result.push(decode_height_from_dem(r, g, b, 0., &self.decoder))
                }
            }

            self.heights_handle = Some(buf.new_f32(result));
            buf.get_f32(&self.heights_handle.unwrap())?
        };

        compute_terrain_height_from_tile(extent, heights, point)
    }

    fn current_max_height(&self) -> Option<f32> {
        self.current_max_height
    }

    fn set_current_max_height(&mut self, h: f32) {
        self.current_max_height = Some(h);
    }

    fn construct_terrain_mesh(
        &self,
        ellipsoid: Ellipsoid<f32>,
        tile: &Tile,
        bytes: &[u8],
        geoid_height: f32,
        martini: &mut Martini,
    ) -> (Geometry, f32, Vec<f32>) {
        let extent = &tile.extent;
        let martini_size = martini.size as usize;

        let mut heights = vec![];
        let mut max_height = 0.0f32;

        let read_height = |x: usize, y: usize| {
            let x = x.min(martini_size - 2);
            let y = y.min(martini_size - 2);
            let i = y * (martini_size - 1) + x;

            let r = bytes[i * 4] as i64;
            let g = bytes[i * 4 + 1] as i64;
            let b = bytes[i * 4 + 2] as i64;

            decode_height_from_dem(r, g, b, geoid_height, &self.decoder)
        };

        // This is a trial and error value. We can update it if necessary, but...
        // 1. The raw geometric error is too large, so you need to adjust the value.
        // 2. If the error is still large when you are close to the tile, upsampling might not work well.
        let max_error = (tile.get_level_maximum_geometric_error(&ellipsoid, 65.) / 2.).min(1024.);

        let mut martini_tile = martini.create_terrain(&read_height);
        let (vertices, indices, uvs) =
            martini_tile.construct_mesh(martini, max_error, &mut |(u, v)| {
                let dlng = (extent.east - extent.west) * u;
                let dlat = (extent.north - extent.south) * v;

                let lng = extent.west + dlng;
                let lat = extent.south + dlat;
                let x = (u * martini_size as f32) as usize;
                let y = ((1. - v) * martini_size as f32) as usize;
                let h = read_height(x, y);

                let XYZ { x, y, z } = ellipsoid.lle_to_xyz(LLE {
                    lng,
                    lat,
                    height: Meters::new(h),
                });

                heights.push(h);
                max_height = max_height.max(h);

                (x.val(), y.val(), z.val())
            });

        // This is just a plane, so increase the number of vertices to make a smooth ellipsoidal surface.
        if indices.len() <= 6 {
            return tile_triangles_with_terrain(
                ellipsoid,
                extent,
                16,
                0.,
                bytes,
                martini_size - 1,
                martini_size - 1,
                &self.decoder,
            );
        }

        (
            Geometry {
                vertices,
                indices,
                uvs,
            },
            max_height,
            heights,
        )
    }

    fn upsample(
        &self,
        region: &TileRegion,
        uvs: &[f32],
        heights: &[f32],
        indices: &[u32],
    ) -> Option<UpsampledTerrainGeometry> {
        Some(UpsampledTerrainGeometry::new(uvs, heights, indices, region))
    }

    fn destroy(&mut self, buf: &mut BufferStore) {
        if let Some(handle) = self.heights_handle.take() {
            buf.remove(&handle);
        }
    }
}

/// Compute a terrain height at specified point.
/// Height is retrieved by a relative index of longitude and latitude to the specified point.
fn compute_terrain_height_from_tile(
    extent: &Extent<f32, Radians>,
    heights: &[f32],
    point: &LngLat<f32, Radians>,
) -> Option<f32> {
    let length = heights.len();
    let width = (length as f32).sqrt() as usize;

    let east = extent.east;
    let north = extent.north;
    let west = extent.west;
    let south = extent.south;

    let dist_ew = (east - west).val();
    let dist_ns = (north - south).val();

    let dist_wlng = (point.lng - west).val();
    let dist_slat = (point.lat - south).val();

    let x = ((dist_wlng / dist_ew) * (width - 1) as f32).round() as usize;
    let y = ((dist_slat / dist_ns) * (width - 1) as f32).round() as usize;

    heights.get((x + y * width).min(length - 1)).copied()
}

#[cfg(test)]
mod test {
    use navara_core::{Angle, LngLat, TileXYZ};

    use super::{compute_terrain_height_from_tile, Tile};

    #[test]
    fn it_should_compute_terrain_height_from_tile() {
        let tile = Tile::new(TileXYZ { x: 3, y: 1, z: 2 }, 0.);
        #[rustfmt::skip]
        let heights = &[
            0., 1., 2., 3.,
            4., 5., 6., 7.,
            8., 9., 10., 11.,
            12., 13., 14., 15.,
        ];
        let result = compute_terrain_height_from_tile(
            &tile.extent,
            heights,
            &LngLat {
                lng: Angle::new(2.5),
                lat: Angle::new(0.5),
            },
        );

        assert_eq!(result.unwrap(), 6.);
    }
}
