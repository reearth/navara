use std::collections::{HashMap, HashSet};

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
    pub rendered_tile_caches: HashMap<TileHandle, TileCache>,
    pub cached_textures_tile_handles: HashSet<TileHandle>,
    pub rendered_frame: usize,
    pub is_updated_in_this_frame: bool,
}
