use bevy_ecs::{entity::Entity, system::Query};

use crate::{
    map::tile::{terrain::TerrainDataRequesterMarker, Tile, TileRegion},
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

                        let r = buf[i];
                        let g = buf[i + 1];
                        let b = buf[i + 2];
                        let a = buf[i + 3];

                        let new_x = (x - child_size * grid_index_x) * 2;
                        let new_y = (y - child_size * grid_index_y) * 2;

                        for dy in 0..2 {
                            for dx in 0..2 {
                                let ni = ((new_x + dx) + (new_y + dy) * parent_size) * 4;
                                next[ni] = r;
                                next[ni + 1] = g;
                                next[ni + 2] = b;
                                next[ni + 3] = a;
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
