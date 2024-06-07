use std::collections::HashMap;

use bevy_ecs::{entity::Entity, system::Resource};

use super::TileHandle;

pub struct TileCache {
    pub tile_entity: Entity,
    pub mesh_entity: Option<Entity>,
    pub rendered_at: usize,
}

// Manage the tiles that are going to be rendered.
#[derive(Default, Resource)]
pub struct TileCacheManager {
    pub caches: HashMap<TileHandle, TileCache>,
    pub rendered_frame: usize,
    pub is_updated_in_this_frame: bool,
}
