#![doc = include_str!("../README.md")]

pub mod data_requester;
pub mod texture_fragment;

use bevy_app::{App, Plugin, PreUpdate, Update};
use bevy_ecs::schedule::IntoSystemConfigs;
use terrain::CachedMartini;
use tile::{event::MeshPreparedEvent, tile_cache_manager::TileCacheManager, TileQuadtree};

pub mod terrain;
pub mod tile;

pub struct TilePlugin;

impl Plugin for TilePlugin {
    fn build(&self, app: &mut App) {
        app.init_resource::<TileCacheManager>()
            .init_resource::<CachedMartini>()
            .insert_resource(TileQuadtree::new_with_region_qt(30))
            .add_event::<MeshPreparedEvent>()
            .add_systems(
                PreUpdate,
                (
                    tile::system::begine_update,
                    terrain::system::begine_terrain_layer,
                    tile::system::handle_prepared_mesh_event,
                )
                    .chain(),
            )
            .add_systems(
                Update,
                (
                    tile::system::update_tiles,
                    tile::system::transfer_mesh,
                    texture_fragment::system::filter_requestable_texture_fragment,
                    data_requester::system::filter_requestable_data_requester,
                    tile::system::clear_caches,
                )
                    .chain(),
            );
    }
}
