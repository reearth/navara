//! PMTiles archive integration for the Bevy/ECS vector-tile pipeline.
//!
//! This crate owns the *container* side of PMTiles: it fetches the archive over
//! HTTP byte ranges, resolves its directories, and serves the raw tile-payload
//! bytes. Decoding those bytes is delegated to an injected [`TilePayloadDecoder`]
//! (the MVT decoder lives in `navara_mvt`), so this crate has no dependency on
//! any payload format.
//!
//! Pure PMTiles v3 parsing lives in the standalone `pmtiles` crate, reached here
//! through `navara_parser::pmtiles`.

mod decoder;
mod source;

pub use decoder::TilePayloadDecoder;
pub use source::{PmtilesMetaOrder, PmtilesSource};

use bevy_app::{App, Plugin, PostUpdate, Update};
use bevy_ecs::schedule::IntoScheduleConfigs;
use navara_data_requester::{DataRequesterSet, send_data_request_events_with_priority_and_sort};
use navara_vector_tile::VectorTileSet;

/// Drives the PMTiles container pipeline: surfacing fetch failures, throttling
/// container (header/leaf) fetches, and dispatching them nearest-first.
///
/// Tile *payload* requests reuse the vector-tile pipeline's own systems (they
/// carry `VectorTileDataRequesterMarker`); this plugin only adds the
/// container-fetch concerns that are specific to PMTiles.
pub struct PmTilesPlugin;

impl Plugin for PmTilesPlugin {
    fn build(&self, app: &mut App) {
        app
            // Surface PMTiles container-fetch failures before tiles are traversed,
            // so a failed archive resolves as failed instead of hanging.
            .add_systems(
                Update,
                source::handle_pmtiles_meta_failures.before(VectorTileSet::Prepare),
            )
            // Cap in-flight PMTiles container (header/leaf) fetches after tiles
            // have spawned them in Prepare, so a global-scale viewport can't
            // saturate the request pipeline with leaf-directory fetches.
            .add_systems(
                Update,
                source::filter_requestable_pmtiles_meta.after(VectorTileSet::Prepare),
            )
            // Dispatch PMTiles container (header/leaf) fetches nearest-first, so
            // the viewport center's directory chain resolves before peripheral regions.
            .add_systems(
                PostUpdate,
                send_data_request_events_with_priority_and_sort::<PmtilesMetaOrder>
                    .in_set(DataRequesterSet::PrioritizeRequests),
            );
    }
}
