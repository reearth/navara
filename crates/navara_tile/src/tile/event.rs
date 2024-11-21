use bevy_ecs::event::Event;
use navara_tile_component::TileHandle;

#[derive(Debug, Event)]
pub struct MeshPreparedEvent {
    pub tile_handle: TileHandle,
}
