use std::fmt::Debug;

use bevy_ecs::{entity::Entity, system::Query};

use crate::{
    map::tile::{terrain::TerrainDataRequesterMarker, Tile, TileRegion},
    Buffer, BufferStore, DataRequester, Handle,
};

pub trait TerrainData: Debug + Sync + Send {
    fn upsample(
        &self,
        region: &TileRegion,
        parent: &Tile,
        terrain_data_requesters: &Query<(&TerrainDataRequesterMarker, &DataRequester)>,
        buf_store: &BufferStore,
    ) -> Option<Buffer>;
    // TODO: Remove this property from BufferStore if unnecessary.
    fn upsampled_buf_handle(&self) -> Option<Handle>;
    fn set_upsampled_buf_handle(&mut self, handle: Option<Handle>);
    fn data_requester_entity_id(&self) -> Option<Entity>;
    fn set_data_requester_entity_id(&mut self, e: Entity);
    // Indicates the max height of the terrain from the globe surface.
    fn current_max_height(&self) -> Option<f32>;
    fn set_current_max_height(&mut self, h: f32);
}
