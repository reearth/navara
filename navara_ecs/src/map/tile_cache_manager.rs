use std::collections::HashMap;

use bevy_ecs::{entity::Entity, system::Resource};
use instant::Instant;

use super::TileHandle;

pub(super) struct TileCache {
    pub(super) tile_entity: Entity,
    pub(super) mesh_entity: Option<Entity>,
    pub(super) rendered_at: Option<Instant>,
}

// Manage the tiles that are going to be rendered.
#[derive(Default, Resource)]
pub(super) struct TileCacheManager {
    pub(super) caches: HashMap<TileHandle, TileCache>,
    pub(super) last_cache_index: Option<usize>,
    pub(super) is_updated_in_this_frame: bool,
}
