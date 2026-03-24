use std::any::Any;

use bevy_ecs::{entity::Entity, prelude::Component, system::Commands};
use navara_buffer_store::BufferStore;
use navara_component::{OrderByDistance, Priority};
use navara_data_requester::DataRequester;
use navara_feature_component::batch::BatchTable;
use navara_tile_component::{TileHandle, VectorTile};

use crate::{
    data_requester::VectorTileDataRequesterQuery, layer::tile_cache_manager::TileCacheManager,
};

/// Tile readiness state, determined by the source.
pub enum ReadyState {
    /// Data available and ready to render.
    Success,
    /// No data at this location (e.g., empty GeoJSON area, server 404).
    Failed,
    /// Waiting for data (e.g., network request in flight).
    Pending,
}

/// Trait for providing tile data from different sources (MVT, GeoJSON, etc.).
#[allow(clippy::too_many_arguments)]
pub trait VectorTileSource: Send + Sync + 'static {
    /// Returns self as `&mut dyn Any` for downcasting.
    fn as_any_mut(&mut self) -> &mut dyn Any;
    /// Check tile availability and create a DataRequester entity.
    ///
    /// For MVT: creates a network DataRequester (Pending status).
    /// For GeoJSON: checks VtIndex, creates immediate Success DataRequester.
    ///
    /// Returns true if a request was initiated.
    fn prepare_tile(
        &mut self,
        commands: &mut Commands,
        tile: &mut VectorTile,
        handle: TileHandle,
        tc: &mut TileCacheManager,
        buf: &mut BufferStore,
        data_requesters: &VectorTileDataRequesterQuery,
        priority: Priority,
    ) -> bool;

    /// Construct geometry entities from tile data.
    ///
    /// For MVT: decode protobuf from BufferStore, build geometry.
    /// For GeoJSON: look up tile in VtIndex, build flat polygons.
    ///
    /// Returns entity IDs of spawned feature entities, or None if no features.
    fn construct_geometry(
        &mut self,
        commands: &mut Commands,
        batch_table: &mut BatchTable,
        buf: &mut BufferStore,
        tile: &VectorTile,
        tile_handle: TileHandle,
        order: &OrderByDistance,
        data_requester: Option<&DataRequester>,
    ) -> Option<Vec<Entity>>;

    /// Check tile readiness. Each source defines its own logic:
    /// - MVT: maps DataRequesterStatus to ReadyState
    /// - GeoJSON: checks VT index; returns Failed for empty tiles
    fn ready_state(
        &self,
        tile: &VectorTile,
        data_requesters: &VectorTileDataRequesterQuery,
    ) -> ReadyState;

    /// Called when tiles are evicted from the viewport cache.
    /// Sources should release any internal caches for these tiles.
    fn evict_tile(&mut self, _handles: TileHandle) {}
}

/// Component wrapping a boxed `VectorTileSource` implementation.
#[derive(Component)]
pub struct TileSource(pub Box<dyn VectorTileSource>);

impl TileSource {
    /// Downcast the inner source to a concrete type.
    pub fn downcast_mut<T: VectorTileSource>(&mut self) -> Option<&mut T> {
        self.0.as_any_mut().downcast_mut::<T>()
    }
}
