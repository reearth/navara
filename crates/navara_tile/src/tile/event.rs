use bevy_ecs::message::Message;
use navara_tile_component::TileHandle;

#[derive(Debug, Message)]
pub struct MeshPreparedEvent {
    pub tile_handle: TileHandle,
}
