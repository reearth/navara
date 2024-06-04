use std::collections::HashMap;

use bevy_ecs::{entity::Entity, system::Resource};
use instant::Instant;

use super::TileHandle;

pub struct TileCache {
    pub tile_entity: Entity,
    pub mesh_entity: Option<Entity>,
    pub rendered_at: Option<Instant>,
}

// Manage the tiles that are going to be rendered.
#[derive(Default, Resource)]
pub struct TileCacheManager {
    pub caches: HashMap<TileHandle, TileCache>,
    pub last_cache_index: Option<usize>,
    pub is_updated_in_this_frame: bool,
}
