use std::collections::{HashMap, HashSet};

use bevy_ecs::{entity::Entity, system::Resource};

use super::TileHandle;

/// This struct caches an information that is necessary in rendering.
/// Of course, we can store these value in the tile of TileQuadtree,
/// but accessing it is a little bit high cost.
/// These values are removed and added frequently,so we should use this cache structure.
pub struct TileCache {
    pub mesh_entity: Option<Entity>,
    pub mesh_prepared: bool,
    pub are_children_prepared: bool,
    pub has_children: bool,
}

impl TileCache {
    pub fn reset_state(&mut self) {
        self.are_children_prepared = false;
        self.has_children = false;
    }
}

// Manage the tiles that are going to be rendered.
#[derive(Default, Resource)]
pub struct TileCacheManager {
    pub rendered_tile_caches: HashMap<TileHandle, TileCache>,
    pub cached_textures_tile_handles: HashSet<TileHandle>,
    pub rendered_frame: usize,
    pub is_updated_in_this_frame: bool,
}

pub const MAX_CACHE_SIZE: usize = 100;
