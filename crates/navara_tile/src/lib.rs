#![doc = include_str!("../README.md")]

use bevy_app::{App, Plugin, PreUpdate, Update};
use bevy_ecs::schedule::IntoSystemConfigs;
use terrain::CachedMartini;
use tile::{tile_cache_manager::TileCacheManager, TileQuadtree};

pub mod terrain;
pub mod tile;

pub struct TilePlugin;

impl Plugin for TilePlugin {
    fn build(&self, app: &mut App) {
        app.init_resource::<TileCacheManager>()
            .init_resource::<CachedMartini>()
            .insert_resource(TileQuadtree::new_with_region_qt(30))
            .add_systems(
                PreUpdate,
                (tile::system::clear_caches, tile::system::begine_update).chain(),
            )
            .add_systems(PreUpdate, terrain::system::begine_terrain_layer)
            .add_systems(
                Update,
                (tile::system::update_tiles, tile::system::transfer_mesh).chain(),
            );
    }
}
