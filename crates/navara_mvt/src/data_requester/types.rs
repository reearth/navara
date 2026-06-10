// Re-export with backward-compatible aliases
pub use navara_vector_tile::data_requester::VectorTileDataRequesterMarker as MvtDataRequesterMarker;
pub use navara_vector_tile::data_requester::VectorTileDataRequesterQuery as MvtDataRequesterQuery;

use bevy_ecs::component::Component;
use navara_component::OrderByDistance;
use navara_data_requester::RequestOrderKey;

/// Request-queue sort key for MVT/PMTiles **tile payload** fetches: highest SSE
/// first, then nearest (the exact ordering of [`OrderByDistance`], which it
/// wraps).
///
/// Tiles already carry a bare [`OrderByDistance`] for the backpressure filter
/// and the worker's geometry sort, but that component is invisible to request
/// dispatch. Wrapping it in [`RequestOrder`](navara_data_requester::RequestOrder)
/// via this key — and registering the matching
/// [`send_data_request_events_with_priority_and_sort`](navara_data_requester::send_data_request_events_with_priority_and_sort)
/// sender — makes the byte-range fetches go out view-center first. That matters
/// most for PMTiles, where every tile is a range request against the one
/// archive URL, so dispatch order is the load order under the browser's small
/// per-host connection limit.
#[derive(Component, PartialEq, Eq, PartialOrd, Ord, Debug, Clone)]
pub struct MvtTileOrder(pub OrderByDistance);

impl RequestOrderKey for MvtTileOrder {}
