#![doc = include_str!("../README.md")]

pub mod data_requester;
pub mod texture_fragment;

use bevy_app::{App, Plugin, PreUpdate, Update};
use bevy_ecs::schedule::IntoScheduleConfigs;
use navara_tile_component::{CachedMartini, RasterTileQuadtree, TerrainInformationQuadtree};
use tile::{event::MeshPreparedEvent, tile_cache_manager::TileCacheManager};

pub mod terrain;
pub mod tile;

pub struct TilePlugin;

impl Plugin for TilePlugin {
    fn build(&self, app: &mut App) {
        app.init_resource::<TileCacheManager>()
            .init_resource::<CachedMartini>()
            .insert_resource(RasterTileQuadtree::new_with_linear_qt())
            .insert_resource(TerrainInformationQuadtree::new_with_linear_qt())
            .add_message::<MeshPreparedEvent>()
            .add_systems(
                PreUpdate,
                (
                    tile::system::handle_prepared_mesh_event,
                    tile::system::handle_tile_worker_task_completed,
                    tile::system::add_order_to_tiles_layer,
                )
                    .chain(),
            )
            .add_systems(
                Update,
                (
                    tile::system::update_layer,
                    tile::system::delete_layer,
                    tile::system::update_tiles,
                    tile::system::transfer_mesh,
                    tile::system::update_mesh_material,
                    texture_fragment::system::filter_requestable_texture_fragment,
                    data_requester::system::filter_requestable_data_requester,
                    tile::system::clear_caches,
                    terrain::system::update_height_observers,
                )
                    .chain(),
            );
    }
}
