use bevy_app::{App, Plugin, PreUpdate, Update};

mod event;
use bevy_ecs::schedule::IntoSystemConfigs;
pub use event::AddLayerEvent;
use event::*;
mod layer;
pub use layer::LayerDescription;
mod tile;
use tile::{tile_cache_manager::TileCacheManager, TileQuadtree};

pub struct MapPlugin;

impl Plugin for MapPlugin {
    fn build(&self, app: &mut App) {
        app.init_resource::<TileCacheManager>()
            .insert_resource(TileQuadtree::new_with_region_qt(30))
            .add_systems(
                PreUpdate,
                (tile::system::clear_caches, tile::system::begine_update).chain(),
            )
            .add_systems(
                Update,
                (
                    process_add_events,
                    (tile::system::update_tiles, tile::system::transfer_mesh).chain(),
                ),
            )
            .add_event::<AddLayerEvent>();
    }
}
