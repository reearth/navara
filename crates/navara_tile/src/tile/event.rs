use bevy_ecs::event::Event;

use super::TileHandle;

#[derive(Debug, Event)]
pub struct MeshPreparedEvent {
    pub tile_handle: TileHandle,
}
