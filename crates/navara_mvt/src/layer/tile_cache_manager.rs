use bevy_ecs::{component::Component, entity::Entity};
use fxhash::FxHashMap;
use navara_tile_component::TileHandle;

// Manage the tiles that are going to be rendered.
#[derive(Default, Component)]
pub struct TileCacheManager {
    pub rendered_tile_caches: FxHashMap<TileHandle, Entity>,
    pub requested_tile_caches: FxHashMap<TileHandle, Entity>,
    pub last_rendered_frame: usize,
    pub is_updated_in_this_frame: bool,
}

impl TileCacheManager {
    pub fn has_same_rendered_tile(&self, handle: &TileHandle, target: &Entity) -> bool {
        self.rendered_tile_caches
            .get(handle) == Some(target)
    }
}
