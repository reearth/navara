#![doc = include_str!("../README.md")]

pub mod data_requester;
mod render_timer;
pub mod texture_fragment;

use bevy_app::{App, Plugin, PreUpdate, Update};
use bevy_ecs::schedule::IntoSystemConfigs;
use render_timer::res::RenderTimer;
use terrain::CachedMartini;
use tile::{tile_cache_manager::TileCacheManager, TileQuadtree};

pub mod terrain;
pub mod tile;

pub struct TilePlugin;

impl Plugin for TilePlugin {
    fn build(&self, app: &mut App) {
        app.init_resource::<TileCacheManager>()
            .init_resource::<CachedMartini>()
            .insert_resource(RenderTimer::new())
            .insert_resource(TileQuadtree::new_with_region_qt(30))
            .add_systems(PreUpdate, render_timer::system::tick)
            .add_systems(PreUpdate, tile::system::clear_caches)
            .add_systems(PreUpdate, terrain::system::begine_terrain_layer)
            .add_systems(
                Update,
                (
                    render_timer::system::reset_timer,
                    tile::system::begine_update,
                    terrain::system::begine_terrain_layer,
                    tile::system::update_tiles,
                    tile::system::transfer_mesh,
                    texture_fragment::system::filter_requestable_texture_fragment,
                    data_requester::system::filter_requestable_data_requester,
                )
                    .chain()
                    .run_if(render_timer::system::run_if),
            );
    }
}
