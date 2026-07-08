//! Finalize worker-parsed MVT groups on the main thread.
//!
//! When the `delegated_worker` feature is enabled, `MvtSource::construct_geometry`
//! spawns a parse task instead of parsing inline (see `source.rs`). On worker
//! completion this system turns the returned plain buffers into batched feature
//! entities — reusing the same finalize path as the synchronous code — and links
//! them back to their `RenderedTile`.

use std::sync::Arc;

use bevy_ecs::{
    entity::Entity,
    query::{With, Without},
    system::{Commands, Query, ResMut},
};
use geozero::mvt::tile;
use navara_buffer_store::{BufferStore, Handle};
use navara_component::{Deleted, OrderByDistance};
use navara_core::{Aabb, Angle, Extent, Radians, TileXYZ};
use navara_feature_component::batch::BatchTable;
use navara_material::Appearance;
use navara_math::{FloatType, Vec3};
use navara_parser::mvt::{
    LayerParseConfig, LayerParseKind, MvtLayerData, PackedMvtStreamsCursor, ParsedMvtGroupHeader,
    UnpackedMvtGroup,
};
use navara_tile_component::TileHandle;
use navara_vector_tile::{RenderedTile, TileCacheManager};
use navara_worker::{
    WorkerTaskCompleted, WorkerTaskDelegateeMarker,
    parse_mvt_tile::{
        ParseMvtTileMarker, ParseMvtTileParameters, ParseMvtTileResult,
        ParseMvtTileWorkerTaskBundle,
    },
};

use crate::source::OwnedMatchedLayerInfo;

use super::process::{
    build_accumulated_geometry, layer_parse_config, spawn_finalized_group, to_appearance_kind,
};

/// Spawn a delegated MVT parse task and its finalize context. Shared by the
/// plain MVT source and the PMTiles decoder so both offload parsing (and, via
/// `compression`, gzip decompression) to the same worker task. Returns `None`
/// (the caller reports "no synchronous features"); features are linked to the
/// tile on completion by [`finalize_parsed_mvt`].
#[allow(clippy::too_many_arguments)]
pub(crate) fn spawn_parse_mvt_task(
    commands: &mut Commands,
    buf: &mut BufferStore,
    rendered_tile: Entity,
    tile_handle: TileHandle,
    coords: TileXYZ,
    tile_extent: Extent<FloatType, Radians>,
    order: &OrderByDistance,
    layers: &[OwnedMatchedLayerInfo],
    pbf_handle: Handle,
    compression: u8,
) -> Option<Vec<Entity>> {
    let configs: Vec<LayerParseConfig> = layers
        .iter()
        .map(|l| layer_parse_config(&l.as_ref()))
        .collect();
    if configs.is_empty() {
        // No task (and thus no finalize) will ever consume the pbf; free it now
        // instead of leaving it resident until the tile's data requester is
        // torn down (the synchronous path consumes it here too).
        buf.remove(&pbf_handle);
        return None;
    }

    // Appearance snapshot per layer: `Arc`-shared with the source, so spawning
    // a parse per tile costs a layer-id string and an `Arc` bump, not a copy of
    // the appearance data.
    let appearances: Vec<(String, Arc<Vec<Appearance>>)> = layers
        .iter()
        .map(|l| (l.layer_id.clone(), Arc::clone(&l.appearances)))
        .collect();

    commands.spawn((
        ParseMvtTileWorkerTaskBundle::new(
            ParseMvtTileMarker,
            ParseMvtTileParameters {
                pbf_handle,
                x: coords.x,
                y: coords.y,
                z: coords.z,
                tile_extent: Some(tile_extent),
                configs,
                compression,
            },
        ),
        order.clone(),
        MvtParseFinalizeContext {
            rendered_tile,
            tile_handle,
            tile_extent: Some(tile_extent),
            order: order.clone(),
            appearances,
            pbf_handle,
        },
    ));

    None
}

/// Main-thread context needed to finalize a parsed tile: which tile the result
/// belongs to and the appearance data required to spawn entities. Attached to
/// the delegator entity by `MvtSource::construct_geometry`.
#[derive(bevy_ecs::component::Component, Clone)]
pub struct MvtParseFinalizeContext {
    /// The exact RenderedTile entity this parse belongs to. Used for identity so
    /// a result never links to a different tile that later reused the handle.
    pub rendered_tile: Entity,
    pub tile_handle: TileHandle,
    pub tile_extent: Option<Extent<FloatType, Radians>>,
    pub order: OrderByDistance,
    /// Appearances per matched layer id (last matching id wins, as in the parse
    /// core), `Arc`-shared with the source's layer list.
    pub appearances: Vec<(String, Arc<Vec<Appearance>>)>,
    /// BufferStore handle to the pbf bytes, freed once finalized.
    pub pbf_handle: navara_buffer_store::Handle,
}

/// Consume completed parse results and spawn their feature entities.
#[allow(clippy::type_complexity)]
pub(crate) fn finalize_parsed_mvt(
    mut commands: Commands,
    mut batch_table: ResMut<BatchTable>,
    mut buf: ResMut<BufferStore>,
    mut completed: Query<
        (Entity, &mut ParseMvtTileResult, &MvtParseFinalizeContext),
        (With<WorkerTaskCompleted>, Without<Deleted>),
    >,
    mut tile_caches: Query<&mut TileCacheManager>,
    mut rendered_tiles: Query<&mut RenderedTile>,
) {
    for (delegator, mut result, ctx) in &mut completed {
        // Only finalize if this parse's RenderedTile is *still* the canonical
        // tile for its handle. If the tile was evicted (handle absent) or the
        // handle was reused by a newer tile (maps to a different entity), the
        // result is stale: drop it without spawning orphan/duplicate features.
        let is_current = tile_caches.iter_mut().any(|mut tc| {
            if tc.rendered_tile_caches.get(&ctx.tile_handle) == Some(&ctx.rendered_tile) {
                // Force a re-traversal so the freshly linked features get
                // activated even when the camera is static by the time parsing
                // finishes (activation only runs while tiles are traversed).
                tc.needs_update = true;
                true
            } else {
                false
            }
        });

        // Always take the packed streams out of the BufferStore — also on the
        // stale path, where dropping them here is what prevents a leak.
        let (f64_stream, f32_stream, u32_stream, u8_stream) = result.take_streams(&mut buf);

        if is_current {
            let rtc_center = ctx.tile_extent.map(worker_rtc_center).unwrap_or(Vec3::ZERO);
            let tile_info = ctx.tile_extent.map(|ext| (ctx.tile_handle, ext));

            let mut cursor =
                PackedMvtStreamsCursor::new(f64_stream, f32_stream, u32_stream, u8_stream);
            // Move the meta out (no clone): the property tables flow straight
            // into the batch table.
            let meta = std::mem::take(&mut result.meta);
            // Rebuild each layer's property table into `Arc`-shared keys/values
            // once; every group of that layer shares the same pair below, so
            // the batch table stores one table per layer like the synchronous
            // path does.
            let mut layer_properties: Vec<(Arc<Vec<String>>, Arc<Vec<tile::Value>>)> =
                Vec::with_capacity(meta.layer_properties.len());
            for props in meta.layer_properties {
                layer_properties.push(props.into_shared_parts());
            }

            for header in meta.headers {
                // Slice the group out even when no appearance matches: the
                // cursor must advance past every group's segments.
                let Some(group) = cursor.next_group(&header) else {
                    // Headers and streams disagree; nothing after this point
                    // can be sliced reliably.
                    break;
                };

                let Some(appearances) = ctx
                    .appearances
                    .iter()
                    .rev()
                    .find(|(id, _)| id == &header.layer_id)
                    .map(|(_, a)| a.as_slice())
                else {
                    continue;
                };

                let Some((keys, values)) = layer_properties.get(header.properties_index as usize)
                else {
                    // Corrupt meta: the header points past the property tables.
                    continue;
                };

                let entities = finalize_group(
                    &mut commands,
                    &mut batch_table,
                    &mut buf,
                    header,
                    group,
                    Arc::clone(keys),
                    Arc::clone(values),
                    appearances,
                    rtc_center,
                    tile_info,
                    &ctx.order,
                );

                if let Ok(mut rt) = rendered_tiles.get_mut(ctx.rendered_tile) {
                    rt.feature_ids.get_or_insert_with(Vec::new).extend(entities);
                }
            }
        }

        // The dispatch frees the pbf when it transfers it to the worker; this is
        // a no-op safety net for the path where it was never dispatched.
        buf.remove(&ctx.pbf_handle);
        // Mark the delegator for cleanup by the worker plugin's `remove` system.
        commands.entity(delegator).insert(Deleted);
    }
}

/// Cancel pending parse tasks whose tile has been evicted (its handle no longer
/// maps to a live `RenderedTile`). Marking the delegator `Deleted` lets the
/// worker plugin tear down the delegatee and cancel the JS worker-pool promise
/// (via `WorkerTaskRemovedEvent`), avoiding wasted parsing and orphan features.
#[allow(clippy::type_complexity)]
pub(crate) fn cancel_evicted_parse_tasks(
    mut commands: Commands,
    mut buf: ResMut<BufferStore>,
    tile_caches: Query<&TileCacheManager>,
    pending: Query<
        (
            Entity,
            &MvtParseFinalizeContext,
            Option<&WorkerTaskDelegateeMarker>,
        ),
        (Without<WorkerTaskCompleted>, Without<Deleted>),
    >,
) {
    for (delegator, ctx, delegatee) in &pending {
        // Still valid only while the handle maps to *this* RenderedTile. Covers
        // eviction (handle gone) and evict + re-add (handle now maps to a newer
        // tile entity).
        let still_current = tile_caches
            .iter()
            .any(|tc| tc.rendered_tile_caches.get(&ctx.tile_handle) == Some(&ctx.rendered_tile));
        if !still_current {
            // Free the pbf in case it was never dispatched (the dispatch frees it
            // otherwise; this is a no-op then), and cancel the task.
            buf.remove(&ctx.pbf_handle);
            // Marking the delegator is enough for cleanup (the worker plugin's
            // `remove` propagates to the delegatee at the despawn point), but
            // marking the delegatee here too aborts the in-flight worker-pool
            // promise one frame sooner.
            if let Some(delegatee) = delegatee {
                commands.entity(delegatee.0).insert(Deleted);
            }
            commands.entity(delegator).insert(Deleted);
        }
    }
}

/// Build one batched feature entity from a group sliced out of the packed
/// worker streams. `keys`/`values` are the layer's property table, shared via
/// `Arc` across all of the layer's groups.
#[allow(clippy::too_many_arguments)]
fn finalize_group(
    commands: &mut Commands,
    batch_table: &mut BatchTable,
    buf: &mut BufferStore,
    header: ParsedMvtGroupHeader,
    group: UnpackedMvtGroup,
    keys: Arc<Vec<String>>,
    values: Arc<Vec<tile::Value>>,
    appearances: &[Appearance],
    rtc_center: Vec3,
    tile_info: Option<(TileHandle, Extent<FloatType, Radians>)>,
    order: &OrderByDistance,
) -> Vec<Entity> {
    let Some(kind) = LayerParseKind::from_u8(header.kind).map(to_appearance_kind) else {
        return Vec::new();
    };

    let batch_id = batch_table
        .init_mvt(
            Some(header.layer_id.clone()),
            MvtLayerData::from_raw(
                keys,
                values,
                group.feature_tags_flat,
                &group.feature_tag_sizes,
            ),
        )
        .unwrap_or(0);

    let item_count = group.geometry.item_count();
    let mut global_batch_ids = Vec::with_capacity(item_count);
    for _ in 0..item_count {
        global_batch_ids.push(batch_table.gen_global_batch_id().unwrap_or(0));
    }

    // The cursor already lowered the group into a `ParsedGeometry`, so the
    // accumulator construction is shared with the synchronous path as-is.
    let accumulated = build_accumulated_geometry(group.geometry, &global_batch_ids, rtc_center);

    spawn_finalized_group(
        commands,
        buf,
        kind,
        global_batch_ids,
        batch_id,
        header.feature_count,
        accumulated,
        appearances,
        &header.layer_id,
        tile_info,
        order,
    )
}

/// Re-derive the RTC center the worker used to encode point offsets.
///
/// The tile extent is truncated to f32 (`ExtentRadianF32`) when it crosses the
/// worker boundary, so the worker computes its center from an f32-precision
/// extent. Finalizing here must round the extent the same way before computing
/// the center: the encoded f32 offsets are added back to *this* origin, so the
/// two centers must be identical. Using the raw f64 extent instead would shift
/// every point by up to ~f32 epsilon in world space (~sub-meter on Earth).
fn worker_rtc_center(ext: Extent<FloatType, Radians>) -> Vec3 {
    let rounded = Extent {
        west: Angle::new(ext.west.val() as f32 as f64),
        south: Angle::new(ext.south.val() as f32 as f64),
        east: Angle::new(ext.east.val() as f32 as f64),
        north: Angle::new(ext.north.val() as f32 as f64),
    };
    Aabb::from_extent_f64(rounded, 0., 1.).center
}

#[cfg(test)]
mod test {
    use bevy_ecs::system::RunSystemOnce;
    use bevy_ecs::world::World;
    use navara_buffer_store::BufferStore;
    use navara_component::Deleted;
    use navara_worker::DelegatedWorkerTaskMarker;

    use super::*;

    /// A cancelled parse marks both the delegator and its delegatee `Deleted`
    /// in the same pass. The worker plugin's `remove` would propagate to the
    /// delegatee at the delegator's despawn anyway; marking it here directly
    /// aborts the in-flight worker-pool promise one frame sooner.
    #[test]
    fn it_should_cancel_the_delegatee_together_with_the_delegator() {
        let mut world = World::new();
        let mut buf = BufferStore::new();
        let pbf_handle = buf.new_u8(vec![1, 2, 3]);
        world.insert_resource(buf);

        let rendered_tile = world.spawn_empty().id();
        let delegatee = world.spawn(DelegatedWorkerTaskMarker).id();
        let delegator = world
            .spawn((
                MvtParseFinalizeContext {
                    rendered_tile,
                    tile_handle: 0,
                    tile_extent: None,
                    order: OrderByDistance {
                        sse: 0.,
                        distance: 0.,
                    },
                    appearances: Vec::new(),
                    pbf_handle,
                },
                WorkerTaskDelegateeMarker(delegatee),
            ))
            .id();

        // No TileCacheManager exists, so the tile is not current: the task
        // must be cancelled.
        world.run_system_once(cancel_evicted_parse_tasks).unwrap();

        assert!(world.entity(delegator).contains::<Deleted>());
        assert!(world.entity(delegatee).contains::<Deleted>());
        assert!(world.resource::<BufferStore>().is_empty());
    }
}
