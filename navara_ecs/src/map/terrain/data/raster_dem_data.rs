use bevy_ecs::{entity::Entity, system::Query};
use navara_core::tile_geometry::{decode_height_from_gsi_dem, encode_height_to_gsi_dem};

use crate::{
    map::tile::{terrain::TerrainDataRequesterMarker, Tile, TileRegion},
    utils::lerp::lerp,
    Buffer, BufferStore, DataRequester,
};

use super::TerrainData;

#[derive(Debug, Default)]
pub struct RasterDEMData {
    pub(crate) data_requester_entity_id: Option<Entity>,
    // Indicates the max height of the terrain from the globe surface.
    pub(crate) current_max_height: Option<f32>,
}

impl TerrainData for RasterDEMData {
    fn data_requester_entity_id(&self) -> Option<Entity> {
        self.data_requester_entity_id
    }
    fn set_data_requester_entity_id(&mut self, e: Entity) {
        self.data_requester_entity_id = Some(e);
    }
    fn current_max_height(&self) -> Option<f32> {
        self.current_max_height
    }
    fn set_current_max_height(&mut self, h: f32) {
        self.current_max_height = Some(h);
    }
    fn upsample(
        &self,
        region: &TileRegion,
        parent: &Tile,
        terrain_data_requesters: &Query<(&TerrainDataRequesterMarker, &DataRequester)>,
        buf_store: &BufferStore,
    ) -> Option<Buffer> {
        let parent_terrain_data_requester =
            match parent.get_terrain_data_requester(terrain_data_requesters) {
                Some(d) => d,
                None => return None,
            };
        let buf = match buf_store.get(&parent_terrain_data_requester.handle) {
            Some(b) => b,
            None => match parent
                .upsampled_buf_handle
                .map_or(None, |h| buf_store.get(&h))
            {
                Some(b) => b,
                None => return None,
            },
        };

        let (grid_index_x, grid_index_y) = match region {
            TileRegion::NorthWest => (0, 0),
            TileRegion::NorthEast => (1, 0),
            TileRegion::SouthWest => (0, 1),
            TileRegion::SouthEast => (1, 1),
        };

        match buf {
            Buffer::U8(buf) => {
                let length = buf.len();
                // It should be rectangle.
                let parent_size = ((length / 4) as f64).sqrt() as usize;
                let child_size = parent_size / 2;

                let mut next = vec![0; length];
                for y in (child_size * grid_index_y)..(child_size * (grid_index_y + 1)) {
                    for x in (child_size * grid_index_x)..(child_size * (grid_index_x + 1)) {
                        let i = (x + y * parent_size) * 4;
                        if buf.get(i).is_none() {
                            continue;
                        }

                        let src_r = buf[i];
                        let src_g = buf[i + 1];
                        let src_b = buf[i + 2];
                        let src_a = buf[i + 3];

                        let new_x = (x - child_size * grid_index_x) * 2;
                        let new_y = (y - child_size * grid_index_y) * 2;

                        // FIXME: Use custom encoding fomula.
                        let src_height = decode_height_from_gsi_dem(
                            src_r as i64,
                            src_g as i64,
                            src_b as i64,
                            0.,
                        );

                        for dy in 0..2 {
                            for dx in 0..2 {
                                let ni = ((new_x + dx) + (new_y + dy) * parent_size) * 4;
                                if dx == 0 && dy == 0 {
                                    next[ni] = src_r;
                                    next[ni + 1] = src_g;
                                    next[ni + 2] = src_b;
                                    next[ni + 3] = src_a;
                                    continue;
                                }

                                let dest_i = ((x as isize
                                    + dx as isize * (1 - (grid_index_x as isize + 1)))
                                    as usize
                                    + (y as isize + dy as isize * (1 - (grid_index_y as isize + 1)))
                                        as usize
                                        * parent_size)
                                    * 4;
                                if buf.get(dest_i).is_none() {
                                    next[ni] = src_r;
                                    next[ni + 1] = src_g;
                                    next[ni + 2] = src_b;
                                    next[ni + 3] = src_a;
                                    continue;
                                }

                                let dest_r = buf[dest_i];
                                let dest_g = buf[dest_i + 1];
                                let dest_b = buf[dest_i + 2];

                                // FIXME: Use custom encoding formula.
                                let dest_height = decode_height_from_gsi_dem(
                                    dest_r as i64,
                                    dest_g as i64,
                                    dest_b as i64,
                                    0.,
                                );

                                let next_height = lerp(src_height, dest_height, 0.5);
                                let encoded_next_height = encode_height_to_gsi_dem(next_height, 0.);

                                next[ni] = encoded_next_height.0 as u8;
                                next[ni + 1] = encoded_next_height.1 as u8;
                                next[ni + 2] = encoded_next_height.2 as u8;
                                next[ni + 3] = src_a;
                            }
                        }
                    }
                }
                Some(Buffer::U8(next))
            }
            _ => unimplemented!(),
        }
    }
}
