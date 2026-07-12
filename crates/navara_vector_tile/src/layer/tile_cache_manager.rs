use bevy_ecs::{component::Component, entity::Entity};
use navara_memory::RetainedEntry;
use navara_tile_component::TileHandle;
use rustc_hash::FxHashMap;

// Manage the tiles that are going to be rendered.
#[derive(Default, Component)]
pub struct TileCacheManager {
    pub rendered_tile_caches: FxHashMap<TileHandle, Entity>,
    pub requested_tile_caches: FxHashMap<TileHandle, Entity>,
    /// Tiles that left the view but are kept alive (deactivated) until the
    /// memory budget forces eviction. Keys are also present in
    /// `rendered_tile_caches`.
    pub retained: FxHashMap<TileHandle, RetainedEntry>,
    pub last_rendered_frame: usize,
    pub is_updated_in_this_frame: bool,
    pub needs_update: bool,
}

impl TileCacheManager {
    pub fn has_same_rendered_tile(&self, handle: &TileHandle, target: &Entity) -> bool {
        self.rendered_tile_caches.get(handle) == Some(target)
    }
}
