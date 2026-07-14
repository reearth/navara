use bevy_ecs::prelude::Resource;
use navara_memory::RetainedEntry;
use navara_tile_component::TileHandle;
use rustc_hash::{FxHashMap, FxHashSet};

/// Tracks which raster tiles were visited so stale ones can be pruned. Raster
/// tiles own no mesh entity, so unlike the terrain `TileCacheManager` this only
/// needs the set of live handles plus frame bookkeeping.
#[derive(Default, Resource)]
pub struct RasterTileCacheManager {
    /// Handles touched by the most recent traversals. Used by
    /// `clear_raster_caches` to find tiles to prune.
    pub active_handles: FxHashSet<TileHandle>,
    /// Tiles that left the view but keep their quadtree node and texture
    /// fragments alive until the memory budget forces eviction. Disjoint
    /// from `active_handles`; a revisit moves the handle back there.
    pub retained: FxHashMap<TileHandle, RetainedEntry>,
    pub last_rendered_frame: usize,
    pub is_updated_in_this_frame: bool,
    pub prev_layers_len: usize,
}
