#![doc = include_str!("../README.md")]

use bevy_app::{App, Plugin, PostUpdate, Update};
use bevy_ecs::schedule::IntoScheduleConfigs;
use navara_data_requester::{DataRequesterSet, send_data_request_events_with_priority_and_sort};
use navara_vector_tile::VectorTileSet;

mod data_requester;
mod geometry;
mod layer;
mod pmtiles_source;
pub mod source;
mod source_cache;

pub use navara_vector_tile::LayerResources as MvtLayerResources;
pub use pmtiles_source::PmtilesSource;
pub use source_cache::{
    MvtSourceCache, MvtSourceId, MvtSourceResources, SourceId, TraversalConfig,
};

pub struct MvtPlugin;

impl Plugin for MvtPlugin {
    fn build(&self, app: &mut App) {
        app.add_systems(
            Update,
            (
                layer::system::update_mvt_layer,
                layer::system::delete_mvt_layer,
            )
                .chain(),
        )
        .add_systems(
            Update,
            layer::system::prepare_layer_resource.in_set(VectorTileSet::Prepare),
        )
        // Surface PMTiles container-fetch failures before tiles are traversed,
        // so a failed archive resolves as failed instead of hanging.
        .add_systems(
            Update,
            pmtiles_source::handle_pmtiles_meta_failures.before(VectorTileSet::Prepare),
        )
        // Dispatch PMTiles container (header/leaf) fetches nearest-first, so the
        // viewport center's directory chain resolves before peripheral regions.
        .add_systems(
            PostUpdate,
            send_data_request_events_with_priority_and_sort::<pmtiles_source::PmtilesMetaOrder>
                .in_set(DataRequesterSet::PrioritizeRequests),
        )
        // Dispatch MVT/PMTiles tile payload fetches nearest-first too. Without
        // this, tile requests carry an `OrderByDistance` that only the
        // backpressure filter reads — the byte-range fetches themselves went out
        // in arbitrary spawn order, so view-center tiles could queue behind
        // peripheral ones under the single-archive-URL connection limit.
        .add_systems(
            PostUpdate,
            send_data_request_events_with_priority_and_sort::<data_requester::MvtTileOrder>
                .in_set(DataRequesterSet::PrioritizeRequests),
        );
    }
}
