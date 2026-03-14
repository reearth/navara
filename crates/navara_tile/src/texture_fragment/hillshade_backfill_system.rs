use bevy_ecs::{
    component::Component,
    entity::Entity,
    query::{Added, Changed, With, Without},
    system::{Commands, Query, Res, ResMut},
};
use navara_buffer_store::BufferStore;
use navara_component::{Deleted, Ignored, OrderByDistance, Priority, Requested};
use navara_data_requester::{DataRequester, DataRequesterStatus};
use navara_event_store::EventStore;
use navara_quadtree::{decode_quadleaf_handle, encode_quadleaf_handle};
use navara_tile_component::{RasterTileQuadtree, TileTextureFragmentMarker};
use std::collections::HashMap;

use crate::dem_backfill::{BackfillDirection, backfill_dem_texture};

const MAX_HILLSHADE_PENDINGS: u32 = 10;

/// Marker component to identify hillshade DEM texture requests
/// This distinguishes hillshade DataRequesters from other types
#[derive(Debug, Clone, Copy, Component)]
pub struct HillshadeTextureMarker;

/// System that limits concurrent hillshade DataRequester entities
/// Prevents too many simultaneous requests by pruning lowest-priority tiles
/// Works similarly to filter_requestable_texture_fragment but for hillshade DataRequesters
#[allow(clippy::type_complexity)]
pub fn filter_requestable_hillshade_data_requester(
    mut commands: Commands,
    mut qt: ResMut<RasterTileQuadtree>,
    hillshade_requesters: Query<
        (
            Entity,
            &TileTextureFragmentMarker,
            &DataRequester,
            &OrderByDistance,
            &Priority,
        ),
        (
            Added<TileTextureFragmentMarker>,
            With<HillshadeTextureMarker>,
            Without<Deleted>,
        ),
    >,
    requested_hillshades: Query<
        Entity,
        (
            With<TileTextureFragmentMarker>,
            With<HillshadeTextureMarker>,
            With<Requested>,
            Without<Deleted>,
        ),
    >,
) {
    let pendings = requested_hillshades.iter().count();
    let num_skip = (MAX_HILLSHADE_PENDINGS as i32 - pendings as i32).max(0);

    // Limit the number of hillshade requests in this frame
    // Sort by priority and distance, then mark excess entities for deletion
    for (e, marker, _, _, _) in hillshade_requesters
        .iter()
        .sort::<(&Priority, &OrderByDistance)>()
        .skip(num_skip as usize)
    {
        let handle = marker.0;
        let tile = qt.qt.get_mut(handle);
        if let Some(tile) = tile {
            commands.entity(e).insert((Deleted, Ignored));

            // Remove this hillshade request from tile's texture_fragment_entity_ids
            if let Some(ids) = tile.texture_fragment_entity_ids.as_mut()
                && let Some(idx) = ids
                    .iter()
                    .enumerate()
                    .find_map(|(i, id)| id.and_then(|id| (id == e).then_some(i)))
            {
                // Remove the slot so texture_fragment_entity_ids stays dense and new requests
                // are not prevented from reusing freed positions.
                ids.remove(idx);
            }
        }
    }
}

/// Component to track DEM backfill state for hillshade textures
#[derive(Debug, Clone, Component)]
pub struct HillshadeDEMState {
    pub original_handle: i32,   // Original DEM data handle from DataRequester
    pub backfilled_handle: i32, // Backfilled data handle with padding
}

/// System that runs after DataRequester loads hillshade DEM data
/// Performs backfill operation and notifies JS
#[allow(clippy::type_complexity, clippy::too_many_arguments)]
pub fn backfill_hillshade_on_loaded(
    mut commands: Commands,
    mut buf: ResMut<BufferStore>,
    qt: Res<RasterTileQuadtree>,
    mut events: ResMut<EventStore>,
    query: Query<
        (Entity, &DataRequester, &TileTextureFragmentMarker),
        (Changed<DataRequester>, With<HillshadeTextureMarker>),
    >,
    all_data_requesters: Query<(
        &DataRequester,
        &TileTextureFragmentMarker,
        &HillshadeTextureMarker,
    )>,
    existing_backfills: Query<(Entity, &mut HillshadeDEMState, &TileTextureFragmentMarker)>,
) {
    // Precompute a lookup for bidirectional neighbor updates: tile_handle -> (Entity, backfilled_handle)
    // This avoids scanning existing_backfills for each neighbor (O(numBackfilledTiles) per neighbor).
    let mut backfilled_neighbors_by_tile: HashMap<u64, (Entity, i32)> = existing_backfills
        .iter()
        .map(|(entity, state, marker)| (marker.0, (entity, state.backfilled_handle)))
        .collect();

    let mut handles_to_remove = Vec::new();

    for (entity, data_req, marker) in query.iter() {
        // Only process successfully loaded hillshade DataRequesters
        if data_req.status != DataRequesterStatus::Success {
            continue;
        }

        let tile_handle = marker.0;

        // Create lookup function to find already-backfilled neighbors
        // This allows us to prefer backfilled buffers (258x258) over original (256x256)
        let backfilled_lookup = |neighbor_tile_handle: u64| -> Option<i32> {
            backfilled_neighbors_by_tile
                .get(&neighbor_tile_handle)
                .map(|(_, handle)| *handle)
        };

        // Perform backfill
        if let Some(backfilled_handle) = backfill_dem_texture(
            &qt,
            &mut buf,
            tile_handle,
            data_req.handle,
            &all_data_requesters,
            &backfilled_lookup,
        ) {
            // Record this newly created backfill so subsequent tiles in this system run
            // can treat it as an already-backfilled neighbor.
            backfilled_neighbors_by_tile.insert(tile_handle, (entity, backfilled_handle));

            // Store state on the entity
            commands.entity(entity).insert(HillshadeDEMState {
                original_handle: data_req.handle,
                backfilled_handle,
            });

            // Notify JS that backfill is complete and texture data is ready
            events
                .hillshade_backfilled
                .push((entity, backfilled_handle, tile_handle));

            handles_to_remove.push(data_req.handle);

            // Bidirectional backfill: Update neighbors' padding with current tile's edge data
            // This ensures seamless transitions between tiles
            let (x, y, z): (usize, usize, usize) = decode_quadleaf_handle(tile_handle);
            let neighbors: [((usize, usize, usize), BackfillDirection); 4] = [
                ((x.wrapping_sub(1), y, z), BackfillDirection::Right), // West neighbor: update their right edge
                ((x + 1, y, z), BackfillDirection::Left), // East neighbor: update their left edge
                ((x, y.wrapping_sub(1), z), BackfillDirection::Bottom), // North neighbor: update their bottom edge
                ((x, y + 1, z), BackfillDirection::Top), // South neighbor: update their top edge
            ];

            // Extract only the edge data we need (~1KB per edge instead of 260KB full texture)
            // Pre-extract all 4 edges to avoid holding immutable borrow during neighbor updates
            let edges = if let Some(current_bytes) = buf.get_u8(&backfilled_handle) {
                extract_edges_for_neighbors(current_bytes)
            } else {
                continue;
            };

            // Process each neighbor
            for ((nx, ny, nz), direction) in neighbors {
                if let Some(neighbor_handle) = encode_quadleaf_handle((nx, ny, nz)) {
                    // Find neighbor's existing backfilled buffer in O(1) using the precomputed map
                    if let Some((neighbor_entity, neighbor_backfilled_handle)) =
                        backfilled_neighbors_by_tile.get(&neighbor_handle)
                    {
                        // Update neighbor's padding with current tile's edge
                        if let Some(neighbor_bytes) = buf.get_u8_mut(neighbor_backfilled_handle) {
                            copy_edge_bidirectional(
                                neighbor_bytes,
                                &edges[direction as usize],
                                direction,
                            );

                            // Notify JS that this neighbor's backfilled buffer has updated padding,
                            // so the existing DataTexture should re-upload/refresh its data (e.g. via needsUpdate)
                            events.hillshade_backfilled.push((
                                *neighbor_entity,
                                *neighbor_backfilled_handle,
                                neighbor_handle,
                            ));
                        }
                    }
                }
            }
        }
    }

    for handle in handles_to_remove {
        buf.remove(&handle);
    }
}

/// Copy edge data from pre-extracted edge to destination's padding (for bidirectional backfill)
/// src is already extracted edge data (content_size * 4 bytes), not full texture
/// direction: which edge of the neighbor tile to update
fn copy_edge_bidirectional(dst: &mut [u8], src_edge: &[u8], direction: BackfillDirection) {
    let dst_size = ((dst.len() / 4) as f64).sqrt() as usize;
    let content_size = dst_size - 2; // 256 for 258x258 padded texture

    // src_edge should be content_size * 4 bytes (e.g., 256 * 4 = 1024 bytes)
    let expected_edge_len = content_size * 4;
    if src_edge.len() != expected_edge_len {
        return; // Invalid edge data
    }

    match direction {
        BackfillDirection::Right => {
            // Update dst's right padding (x=content_size+1) from src's left edge
            for y in 0..content_size {
                let src_idx = y * 4; // Source is linear edge data
                let dst_x = content_size + 1; // dst's right padding
                let dst_y = y + 1;
                let dst_idx = (dst_y * dst_size + dst_x) * 4;

                if dst_idx + 4 <= dst.len() {
                    dst[dst_idx..dst_idx + 4].copy_from_slice(&src_edge[src_idx..src_idx + 4]);
                }
            }
        }
        BackfillDirection::Left => {
            // Update dst's left padding (x=0) from src's right edge
            for y in 0..content_size {
                let src_idx = y * 4; // Source is linear edge data
                let dst_x = 0; // dst's left padding
                let dst_y = y + 1;
                let dst_idx = (dst_y * dst_size + dst_x) * 4;

                if dst_idx + 4 <= dst.len() {
                    dst[dst_idx..dst_idx + 4].copy_from_slice(&src_edge[src_idx..src_idx + 4]);
                }
            }
        }
        BackfillDirection::Bottom => {
            // Update dst's bottom padding (y=content_size+1) from src's top edge
            for x in 0..content_size {
                let src_idx = x * 4; // Source is linear edge data
                let dst_x = x + 1;
                let dst_y = content_size + 1; // dst's bottom padding
                let dst_idx = (dst_y * dst_size + dst_x) * 4;

                if dst_idx + 4 <= dst.len() {
                    dst[dst_idx..dst_idx + 4].copy_from_slice(&src_edge[src_idx..src_idx + 4]);
                }
            }
        }
        BackfillDirection::Top => {
            // Update dst's top padding (y=0) from src's bottom edge
            for x in 0..content_size {
                let src_idx = x * 4; // Source is linear edge data
                let dst_x = x + 1;
                let dst_y = 0; // dst's top padding
                let dst_idx = (dst_y * dst_size + dst_x) * 4;

                if dst_idx + 4 <= dst.len() {
                    dst[dst_idx..dst_idx + 4].copy_from_slice(&src_edge[src_idx..src_idx + 4]);
                }
            }
        }
    }
}

/// Extract 4 edges from current tile for updating neighbors
/// Returns array indexed by BackfillDirection (the edge to update on neighbor):
/// [edge_for_left, edge_for_right, edge_for_top, edge_for_bottom]
fn extract_edges_for_neighbors(src: &[u8]) -> [Vec<u8>; 4] {
    let src_size = ((src.len() / 4) as f64).sqrt() as usize;
    let content_size = src_size - 2; // 256 for 258x258 padded texture

    // Preallocate edge buffers (each edge: content_size pixels * 4 bytes RGBA)
    let mut for_neighbor_left = Vec::with_capacity(content_size * 4); // Current right -> neighbor left
    let mut for_neighbor_right = Vec::with_capacity(content_size * 4); // Current left -> neighbor right
    let mut for_neighbor_top = Vec::with_capacity(content_size * 4); // Current bottom -> neighbor top
    let mut for_neighbor_bottom = Vec::with_capacity(content_size * 4); // Current top -> neighbor bottom

    // Extract left edge (x=1) -> for updating west neighbor's right padding
    for y in 0..content_size {
        let src_x = 1;
        let src_y = y + 1;
        let src_idx = (src_y * src_size + src_x) * 4;
        if src_idx + 4 <= src.len() {
            for_neighbor_right.extend_from_slice(&src[src_idx..src_idx + 4]);
        }
    }

    // Extract right edge (x=content_size) -> for updating east neighbor's left padding
    for y in 0..content_size {
        let src_x = content_size;
        let src_y = y + 1;
        let src_idx = (src_y * src_size + src_x) * 4;
        if src_idx + 4 <= src.len() {
            for_neighbor_left.extend_from_slice(&src[src_idx..src_idx + 4]);
        }
    }

    // Extract top edge (y=1) -> for updating north neighbor's bottom padding
    for x in 0..content_size {
        let src_x = x + 1;
        let src_y = 1;
        let src_idx = (src_y * src_size + src_x) * 4;
        if src_idx + 4 <= src.len() {
            for_neighbor_bottom.extend_from_slice(&src[src_idx..src_idx + 4]);
        }
    }

    // Extract bottom edge (y=content_size) -> for updating south neighbor's top padding
    for x in 0..content_size {
        let src_x = x + 1;
        let src_y = content_size;
        let src_idx = (src_y * src_size + src_x) * 4;
        if src_idx + 4 <= src.len() {
            for_neighbor_top.extend_from_slice(&src[src_idx..src_idx + 4]);
        }
    }

    // Return in order matching BackfillDirection enum values
    [
        for_neighbor_left,   // BackfillDirection::Left = 0
        for_neighbor_right,  // BackfillDirection::Right = 1
        for_neighbor_top,    // BackfillDirection::Top = 2
        for_neighbor_bottom, // BackfillDirection::Bottom = 3
    ]
}

/// System that cleans up backfilled DEM buffers when hillshade entities are deleted
/// This prevents memory leaks by removing the padded buffers from BufferStore
pub fn cleanup_hillshade_backfilled_buffers(
    mut commands: Commands,
    mut buf: ResMut<BufferStore>,
    query: Query<(Entity, &HillshadeDEMState), With<Deleted>>,
) {
    for (entity, state) in query.iter() {
        // Remove the backfilled buffer (padded 258x258 texture)
        buf.remove(&state.backfilled_handle);

        // Despawn the entity to complete cleanup
        commands.entity(entity).despawn();
    }
}
