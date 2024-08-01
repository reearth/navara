use bevy_app::{App, Plugin, PostUpdate, PreUpdate, Update};

mod event;
mod terrain;
use bevy_ecs::schedule::IntoSystemConfigs;
pub use event::AddLayerEvent;
use event::*;
pub mod feature;
mod geojson;
mod tile;
use terrain::CachedMartini;
use tile::{tile_cache_manager::TileCacheManager, TileQuadtree};

pub struct MapPlugin;

impl Plugin for MapPlugin {
    fn build(&self, app: &mut App) {
        app.init_resource::<TileCacheManager>()
            .init_resource::<CachedMartini>()
            .insert_resource(TileQuadtree::new_with_region_qt(30))
            .add_event::<AddLayerEvent>()
            .add_systems(
                PreUpdate,
                (tile::system::clear_caches, tile::system::begine_update).chain(),
            )
            .add_systems(PreUpdate, terrain::system::begine_terrain_layer)
            .add_systems(Update, process_add_events)
            .add_systems(
                Update,
                (tile::system::update_tiles, tile::system::transfer_mesh).chain(),
            )
            .add_systems(
                Update,
                (
                    geojson::system::construct_feature,
                    geojson::system::update_feature_by_tile_change,
                ),
            )
            .add_systems(PostUpdate, feature::event::commit);
    }
}
