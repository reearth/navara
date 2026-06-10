//! [`PmtilesSource`]: a [`VectorTileSource`] whose tiles come from a single
//! PMTiles v3 archive (MVT payload) fetched over HTTP byte ranges.
//!
//! The container parsing/resolution lives in `navara_pmtiles`; this type is the
//! thin ECS binding. It differs from [`MvtSource`](crate::source::MvtSource) in
//! exactly one place — `prepare_tile`, which drives the archive and issues
//! byte-range requests — and reuses the identical MVT decode path in
//! `construct_geometry`.
//!
//! ## Request kinds
//! - **Meta requests** (header + leaf directories): tagged [`PmtilesMetaMarker`]
//!   with no [`VectorTileDataRequesterMarker`], so they're dispatched to JS by
//!   the data-requester sender but ignored by the vector-tile request
//!   backpressure. There are very few of them per archive.
//! - **Tile requests**: tagged [`VectorTileDataRequesterMarker`] exactly like
//!   `MvtSource`, so they're tracked, throttled, and cleaned up identically.
//!
//! Both kinds use unmanaged [`DataRequester::from_store`] requests, so multiple
//! ranges against the one archive URL never collapse via `DataManager` dedup.

use std::any::Any;
use std::collections::HashMap;

use bevy_ecs::{
    component::Component,
    entity::Entity,
    query::With,
    system::{Commands, Query},
};
use navara_buffer_store::{BufferStore, Handle};
use navara_component::{OrderByDistance, Priority};
use navara_data_requester::{DataRequester, DataRequesterExtension, DataRequesterStatus};
use navara_feature_component::batch::BatchTable;
use navara_pmtiles::{ByteRange, Compression, PmtilesArchive, Resolution};
use navara_tile_component::{TileHandle, VectorTile};
use navara_vector_tile::{
    ReadyState, TileCacheManager, TileSource, VectorTileSource,
    data_requester::{VectorTileDataRequesterMarker, VectorTileDataRequesterQuery},
};

use crate::{
    geometry::{MatchedLayerInfo, construct_geometry_multi_layer},
    source::OwnedMatchedLayerInfo,
};

/// Marks a [`DataRequester`] that fetches PMTiles container bytes (the header
/// or a leaf directory) rather than a tile payload. Kept distinct from
/// [`VectorTileDataRequesterMarker`] so these requests bypass tile backpressure.
#[derive(Component)]
pub struct PmtilesMetaMarker;

/// A vector-tile source backed by a PMTiles archive.
pub struct PmtilesSource {
    /// URL of the `.pmtiles` archive (no `{z}/{x}/{y}` template).
    pub url: String,
    /// Per-layer styling/filtering, shared with the MVT decode path.
    pub layers: Vec<OwnedMatchedLayerInfo>,
    /// Container parsing/resolution state machine.
    archive: PmtilesArchive,
    /// In-flight header/root-directory request, if any: `(entity, buffer handle)`.
    bootstrap_req: Option<(Entity, Handle)>,
    /// In-flight leaf-directory requests, keyed by leaf offset.
    leaf_reqs: HashMap<u64, (Entity, Handle)>,
}

impl PmtilesSource {
    /// Create a source for `url` with the given layers.
    #[must_use]
    pub fn new(url: String, layers: Vec<OwnedMatchedLayerInfo>) -> Self {
        Self {
            url,
            layers,
            archive: PmtilesArchive::new(),
            bootstrap_req: None,
            leaf_reqs: HashMap::new(),
        }
    }

    /// Spawn an unmanaged meta request for `range` and return its tracking pair.
    fn spawn_meta(
        &self,
        commands: &mut Commands,
        buf: &mut BufferStore,
        range: ByteRange,
    ) -> (Entity, Handle) {
        let req = DataRequester::from_store(self.url.clone(), buf, DataRequesterExtension::Mvt)
            .with_byte_range(range.offset, range.length);
        let handle = req.handle;
        let entity = commands
            .spawn((PmtilesMetaMarker, req, Priority::High))
            .id();
        (entity, handle)
    }

    /// Advance the archive: feed any completed header/leaf bytes, then issue the
    /// next bootstrap request if one is due. Cheap and idempotent, so it's safe
    /// to call once per `prepare_tile` (which may run for many tiles per frame).
    fn drive(&mut self, commands: &mut Commands, buf: &mut BufferStore) {
        // Bootstrap: consume completed bytes...
        if let Some((entity, handle)) = self.bootstrap_req
            && let Some(bytes) = buf.remove_u8(&handle)
        {
            // A parse error transitions the archive to failed; surfaced via `ready_state`.
            let _ = self.archive.on_bootstrap_bytes(&bytes);
            commands.entity(entity).despawn();
            self.bootstrap_req = None;
        }
        // ...then issue the next bootstrap request (header, or a fallback root dir).
        if self.bootstrap_req.is_none()
            && !self.archive.is_ready()
            && !self.archive.is_failed()
            && let Some(range) = self.archive.take_bootstrap_request()
        {
            self.bootstrap_req = Some(self.spawn_meta(commands, buf, range));
        }

        // Leaves: feed any whose bytes have landed.
        let ready: Vec<u64> = self
            .leaf_reqs
            .iter()
            .filter(|(_, (_, handle))| buf.contains(handle))
            .map(|(offset, _)| *offset)
            .collect();
        for offset in ready {
            let (entity, handle) = self
                .leaf_reqs
                .remove(&offset)
                .expect("offset just collected");
            if let Some(bytes) = buf.remove_u8(&handle) {
                let _ = self.archive.on_leaf_bytes(offset, &bytes);
            }
            commands.entity(entity).despawn();
        }
    }

    /// Resolve a tile's data-requester status into a [`ReadyState`] (mirrors
    /// `MvtSource`).
    fn tile_ready_state(
        &self,
        tile: &VectorTile,
        data_requesters: &VectorTileDataRequesterQuery,
    ) -> ReadyState {
        let data_requester = tile
            .data_requester_entity_id
            .and_then(|e| data_requesters.get(e).ok());
        match data_requester {
            Some((_, dr)) if tile.is_ready(&dr.status) => ReadyState::Success,
            Some((_, dr)) if matches!(dr.status, DataRequesterStatus::Fail) => ReadyState::Failed,
            _ => ReadyState::Pending,
        }
    }

    /// Detect meta requests (header / leaf directory) that failed at the
    /// network layer and reflect that on the archive: a failed bootstrap fails
    /// the whole archive; a failed leaf is recorded so its tiles resolve to
    /// `Absent` rather than looping.
    ///
    /// This needs the `DataRequester` status — failures never write a buffer,
    /// so `drive`'s `buf` polling cannot observe them. Called from the
    /// [`handle_pmtiles_meta_failures`] system, which has the status query.
    fn handle_meta_failures(
        &mut self,
        commands: &mut Commands,
        requesters: &Query<&DataRequester, With<PmtilesMetaMarker>>,
    ) {
        if let Some((entity, _)) = self.bootstrap_req
            && requesters.get(entity).is_ok_and(DataRequester::is_failed)
        {
            self.archive.mark_failed();
            commands.entity(entity).despawn();
            self.bootstrap_req = None;
        }

        let failed: Vec<(u64, Entity)> = self
            .leaf_reqs
            .iter()
            .filter(|(_, (entity, _))| requesters.get(*entity).is_ok_and(DataRequester::is_failed))
            .map(|(offset, (entity, _))| (*offset, *entity))
            .collect();
        for (offset, entity) in failed {
            self.archive.mark_leaf_failed(offset);
            self.leaf_reqs.remove(&offset);
            commands.entity(entity).despawn();
        }
    }
}

/// System: surface network failures of PMTiles container (header/leaf) fetches
/// onto their archives. Without it, a failed bootstrap would leave the layer
/// stuck `Pending` (blank) forever, since such failures produce no buffer bytes.
pub(crate) fn handle_pmtiles_meta_failures(
    mut commands: Commands,
    mut sources: Query<&mut TileSource>,
    requesters: Query<&DataRequester, With<PmtilesMetaMarker>>,
) {
    for mut tile_source in &mut sources {
        if let Some(source) = tile_source.downcast_mut::<PmtilesSource>() {
            source.handle_meta_failures(&mut commands, &requesters);
        }
    }
}

impl VectorTileSource for PmtilesSource {
    fn as_any_mut(&mut self) -> &mut dyn Any {
        self
    }

    fn prepare_tile(
        &mut self,
        commands: &mut Commands,
        tile: &mut VectorTile,
        handle: TileHandle,
        tc: &mut TileCacheManager,
        buf: &mut BufferStore,
        data_requesters: &VectorTileDataRequesterQuery,
        priority: Priority,
    ) -> bool {
        self.drive(commands, buf);

        if !self.archive.is_ready() {
            // Keep the update loop alive while bootstrapping (a failed archive
            // stops here, leaving tiles to resolve as `Failed` in ready_state).
            if !self.archive.is_failed() {
                tc.needs_update = true;
            }
            return false;
        }

        match self.archive.resolve(
            tile.coords.z as u8,
            tile.coords.x as u32,
            tile.coords.y as u32,
        ) {
            Resolution::Tile { request } => {
                // Don't duplicate a tile request that's already in flight.
                if matches!(tile.data_requester_entity_id, Some(e) if data_requesters.contains(e)) {
                    return false;
                }
                let entity = commands
                    .spawn((
                        VectorTileDataRequesterMarker(handle),
                        DataRequester::from_store(
                            self.url.clone(),
                            buf,
                            DataRequesterExtension::Mvt,
                        )
                        .with_byte_range(request.offset, request.length),
                        OrderByDistance {
                            sse: tile.sse,
                            distance: tile.distance_from_camera,
                        },
                        priority,
                    ))
                    .id();
                tile.data_requester_entity_id = Some(entity);
                tc.requested_tile_caches.insert(handle, entity);
                true
            }
            Resolution::NeedLeaf {
                leaf_offset,
                request,
            } => {
                if !self.leaf_reqs.contains_key(&leaf_offset) {
                    let req = self.spawn_meta(commands, buf, request);
                    self.leaf_reqs.insert(leaf_offset, req);
                }
                tc.needs_update = true; // keep polling until the leaf lands
                false
            }
            Resolution::Absent => false,
        }
    }

    fn construct_geometry(
        &mut self,
        commands: &mut Commands,
        batch_table: &mut BatchTable,
        buf: &mut BufferStore,
        tile: &VectorTile,
        tile_handle: TileHandle,
        order: &OrderByDistance,
        data_requester: Option<&DataRequester>,
    ) -> Option<Vec<Entity>> {
        let data_req = data_requester?;
        let raw = buf.remove_u8(&data_req.handle)?;

        // Tiles inside the archive may be individually gzip-compressed.
        let compression = self
            .archive
            .header()
            .map_or(Compression::None, |h| h.tile_compression);
        let mvt_bin = navara_pmtiles::decompress(compression, &raw).ok()?;

        let matched_layers: Vec<MatchedLayerInfo> = self
            .layers
            .iter()
            .map(OwnedMatchedLayerInfo::as_ref)
            .collect();

        construct_geometry_multi_layer(
            commands,
            batch_table,
            buf,
            mvt_bin,
            tile.coords,
            &matched_layers,
            Some((tile_handle, tile.extent)),
            order,
        )
    }

    fn ready_state(
        &self,
        tile: &VectorTile,
        data_requesters: &VectorTileDataRequesterQuery,
    ) -> ReadyState {
        if self.archive.is_failed() {
            return ReadyState::Failed;
        }
        if !self.archive.is_ready() {
            return ReadyState::Pending;
        }
        match self.archive.resolve(
            tile.coords.z as u8,
            tile.coords.x as u32,
            tile.coords.y as u32,
        ) {
            // No tile here: report failed so traversal stops waiting on it.
            Resolution::Absent => ReadyState::Failed,
            // A leaf still has to be fetched before this tile can resolve.
            Resolution::NeedLeaf { .. } => ReadyState::Pending,
            Resolution::Tile { .. } => self.tile_ready_state(tile, data_requesters),
        }
    }
}
