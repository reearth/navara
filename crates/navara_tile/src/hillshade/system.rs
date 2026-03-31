use bevy_ecs::{
    component::Component,
    entity::Entity,
    query::{Added, Changed, With, Without},
    system::{Commands, Query, Res, ResMut},
};
use navara_buffer_store::BufferStore;
use navara_component::{Deleted, Ignored, OrderByDistance, Priority, Requested};
use navara_data_requester::DataRequester;
use navara_event_store::EventStore;
use navara_quadtree::{decode_quadleaf_handle, encode_quadleaf_handle};
use navara_tile_component::{
    HillshadeBackfillEventData, HillshadeBackfillEvents, HillshadeEdges, HillshadeEdgesExtracted,
};
use navara_tile_component::{RasterTileQuadtree, TileTextureFragmentMarker};

const MAX_HILLSHADE_PENDINGS: u32 = 10;

/// Marker component to identify hillshade DEM texture requests
/// This distinguishes hillshade DataRequesters from other types
#[derive(Debug, Clone, Copy, Component)]
pub struct HillshadeTextureMarker;

/// Marker component indicating that HillshadeBackfillEvents have been extracted
/// Used to delay cleanup until after read_events() has accessed the data
#[derive(Debug, Clone, Copy, Component)]
pub(crate) struct HillshadeEventsExtracted;

/// Query type for cleanup_hillshade_edges system
type CleanupHillshadeEdgesQuery<'w, 's> =
    Query<'w, 's, (Entity, &'static HillshadeEdges), (With<Deleted>, With<HillshadeTextureMarker>)>;

/// Extracted edge data from a hillshade DEM texture
/// Contains all 4 edges for sharing with neighbors
struct ExtractedEdges {
    left: Vec<u8>,
    right: Vec<u8>,
    top: Vec<u8>,
    bottom: Vec<u8>,
}

/// Edge direction for hillshade texture updates
#[derive(Debug, Clone, Copy)]
enum EdgeDirection {
    Left = 0,
    Right = 1,
    Top = 2,
    Bottom = 3,
}

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
    for (e, marker, _, _) in hillshade_requesters
        .iter()
        .sort::<(&Priority, &OrderByDistance)>()
        .skip(num_skip as usize)
    {
        let handle = marker.0;
        let tile = qt.qt.get_mut(handle);
        if let Some(tile) = tile {
            commands.entity(e).insert((Deleted, Ignored));

            // Find and remove from both arrays to maintain alignment
            if let Some(hillshade_ids) = tile.hillshade_entity_ids.as_mut()
                && let Some(idx) = hillshade_ids
                    .iter()
                    .enumerate()
                    .find_map(|(i, id)| id.and_then(|id| (id == e).then_some(i)))
            {
                // Remove from both arrays at same index
                hillshade_ids.remove(idx);

                // texture_fragment_entity_ids MUST exist and have same length
                // because request_texture_fragment always pushes to both arrays
                if let Some(tex_ids) = tile.texture_fragment_entity_ids.as_mut()
                    && idx < tex_ids.len()
                {
                    tex_ids.remove(idx);
                }
            }
        }
    }
}

/// System that runs after DataRequester loads hillshade DEM data
/// Sends edge data to JS for texture edge updates
#[allow(clippy::type_complexity, clippy::too_many_arguments)]
pub fn backfill_hillshade_on_loaded(
    mut commands: Commands,
    mut buf: ResMut<BufferStore>,
    qt: Res<RasterTileQuadtree>,
    mut events: ResMut<EventStore>,
    query: Query<
        (Entity, &DataRequester, &TileTextureFragmentMarker),
        (
            Changed<DataRequester>,
            With<HillshadeTextureMarker>,
            Without<Deleted>,
            Without<Ignored>,
        ),
    >,
    edges_query: Query<&HillshadeEdges>,
    extracted_query: Query<(), With<HillshadeEdgesExtracted>>,
    data_requesters: Query<
        &DataRequester,
        (
            With<HillshadeTextureMarker>,
            Without<Deleted>,
            Without<Ignored>,
        ),
    >,
) {
    for (entity, data_req, marker) in query.iter() {
        // Only process successfully loaded hillshade DataRequesters
        if !data_req.is_succeeded() {
            continue;
        }

        let tile_handle = marker.0;
        let (x, y, z): (usize, usize, usize) = decode_quadleaf_handle(tile_handle);
        let mut event_data_list = Vec::new();

        // Extract edges on first load (sends original data to JS and extracts edges)
        let edges_extracted = extracted_query.contains(entity);
        let extracted_edges = if !edges_extracted {
            event_data_list.push(HillshadeBackfillEventData {
                tile_handle,
                edge_data_handle: -1,
                original_handle: Some(data_req.handle),
                target_entity: None,
                edge_direction: 255,
            });

            extract_edges_on_first_load(&buf, data_req)
        } else {
            None
        };

        // Collect edge exchanges with all loaded neighbors
        let edges_to_store = collect_neighbor_edge_exchanges(
            entity,
            tile_handle,
            x,
            y,
            z,
            &extracted_edges,
            &edges_query,
            &qt,
            &data_requesters,
            &buf,
        );

        // Store all collected edges in BufferStore and create events
        for (edge_bytes, target_handle, target_entity, edge_dir) in edges_to_store {
            if edge_bytes.is_empty() {
                continue;
            }
            let edge_handle = buf.new_u8(edge_bytes);
            event_data_list.push(HillshadeBackfillEventData {
                tile_handle: target_handle,
                edge_data_handle: edge_handle,
                original_handle: None,
                target_entity: Some(target_entity),
                edge_direction: edge_dir,
            });
        }

        // Store extracted edges (original data will be cleaned by JS side)
        if let Some(edges) = extracted_edges {
            store_extracted_edges(entity, edges, &mut commands, &mut buf);
        }

        // Add all events to entity and push to EventStore
        commands.entity(entity).insert(HillshadeBackfillEvents {
            events: event_data_list,
        });
        events.hillshade_backfilled.push(entity);
    }
}

/// System that cleans up hillshade edge data when entities are deleted
/// Removes the 4 edge buffers from BufferStore to prevent memory leaks
pub fn cleanup_hillshade_edges(
    mut commands: Commands,
    mut buf: ResMut<BufferStore>,
    removed: CleanupHillshadeEdgesQuery,
) {
    for (entity, edges) in removed.iter() {
        // Remove all 4 edge buffers
        buf.remove(&edges.left);
        buf.remove(&edges.right);
        buf.remove(&edges.top);
        buf.remove(&edges.bottom);
        // Ensure this cleanup runs only once per entity by removing HillshadeEdges
        commands.entity(entity).remove::<HillshadeEdges>();
    }
}

/// System that cleans up HillshadeBackfillEvents after events are dispatched
/// Prevents memory leaks and stale event re-emission
/// Uses a two-phase approach: mark in first frame, cleanup in second frame
pub(crate) fn cleanup_hillshade_backfill_events(
    mut commands: Commands,
    query: Query<(Entity, Option<&HillshadeEventsExtracted>), With<HillshadeBackfillEvents>>,
) {
    for (entity, extracted_marker) in query.iter() {
        if extracted_marker.is_some() {
            // Frame N+1: Marker exists, safe to cleanup
            // Frame N: backfill_hillshade_on_loaded → insert(HillshadeBackfillEvents)
            // Frame N: read_events() → extracts events
            // Frame N: this system → adds HillshadeEventsExtracted marker
            // Frame N+1: this system → removes both components
            commands.entity(entity).remove::<HillshadeBackfillEvents>();
            commands.entity(entity).remove::<HillshadeEventsExtracted>();
        } else {
            // Frame N: Just added, mark as extracted but don't cleanup yet
            // This allows read_events() to access data before removal
            commands.entity(entity).insert(HillshadeEventsExtracted);
        }
    }
}

/// Extract edges on first load and create initialization event
/// Returns the extracted edges for reuse with neighbors
fn extract_edges_on_first_load(
    buf: &BufferStore,
    data_req: &DataRequester,
) -> Option<ExtractedEdges> {
    buf.get_u8(&data_req.handle)
        .map(|original_bytes| ExtractedEdges {
            left: extract_single_edge(original_bytes, EdgeDirection::Left),
            right: extract_single_edge(original_bytes, EdgeDirection::Right),
            top: extract_single_edge(original_bytes, EdgeDirection::Top),
            bottom: extract_single_edge(original_bytes, EdgeDirection::Bottom),
        })
}

/// Get edge data from tile (either from extracted_edges or stored handles)
fn get_edge_from_tile(
    entity: Entity,
    direction: EdgeDirection,
    extracted_edges: &Option<ExtractedEdges>,
    edges_query: &Query<&HillshadeEdges>,
    buf: &BufferStore,
) -> Option<Vec<u8>> {
    if let Some(edges) = extracted_edges {
        // Use freshly extracted edges (first time loading)
        Some(match direction {
            EdgeDirection::Left => edges.left.clone(),
            EdgeDirection::Right => edges.right.clone(),
            EdgeDirection::Top => edges.top.clone(),
            EdgeDirection::Bottom => edges.bottom.clone(),
        })
    } else if let Ok(edges) = edges_query.get(entity) {
        // Use stored edge handles (subsequent loads)
        let edge_handle = match direction {
            EdgeDirection::Left => edges.left,
            EdgeDirection::Right => edges.right,
            EdgeDirection::Top => edges.top,
            EdgeDirection::Bottom => edges.bottom,
        };
        Some(
            buf.get_u8(&edge_handle)
                .map(|b| b.to_vec())
                .unwrap_or_default(),
        )
    } else {
        None
    }
}

/// Get neighbor tile coordinates with bounds checking
/// Returns None if neighbor is out of valid range
/// X wraps around, Y does not
fn get_neighbor_coords(
    x: usize,
    y: usize,
    z: usize,
    direction: EdgeDirection,
) -> Option<(usize, usize, usize)> {
    let tile_count = 1_usize << z; // 2^z tiles per axis at zoom level z

    match direction {
        EdgeDirection::Left => {
            // West: wrap X coordinate
            let nx = if x == 0 { tile_count - 1 } else { x - 1 };
            Some((nx, y, z))
        }
        EdgeDirection::Right => {
            // East: wrap X coordinate
            let nx = if x + 1 >= tile_count { 0 } else { x + 1 };
            Some((nx, y, z))
        }
        EdgeDirection::Top => {
            // North: Y does not wrap, check bounds
            if y == 0 {
                None // No tile north of y=0
            } else {
                Some((x, y - 1, z))
            }
        }
        EdgeDirection::Bottom => {
            // South: Y does not wrap, check bounds
            if y + 1 >= tile_count {
                None // No tile south of max Y
            } else {
                Some((x, y + 1, z))
            }
        }
    }
}

/// Collect edge exchanges with all loaded neighbors
/// Returns list of (edge_bytes, target_tile_handle, target_entity, edge_direction)
#[allow(clippy::type_complexity, clippy::too_many_arguments)]
fn collect_neighbor_edge_exchanges(
    entity: Entity,
    tile_handle: u64,
    x: usize,
    y: usize,
    z: usize,
    extracted_edges: &Option<ExtractedEdges>,
    edges_query: &Query<&HillshadeEdges>,
    qt: &RasterTileQuadtree,
    data_requesters: &Query<
        &DataRequester,
        (
            With<HillshadeTextureMarker>,
            Without<Deleted>,
            Without<Ignored>,
        ),
    >,
    buf: &BufferStore,
) -> Vec<(Vec<u8>, u64, Entity, u8)> {
    // Define neighbor directions (coordinates will be computed with bounds checking)
    let neighbor_directions = [
        EdgeDirection::Left,   // West neighbor
        EdgeDirection::Right,  // East neighbor
        EdgeDirection::Top,    // North neighbor
        EdgeDirection::Bottom, // South neighbor
    ];

    let mut edges_to_store = Vec::new();

    for direction in neighbor_directions {
        // Get neighbor coordinates with bounds checking and wrapping
        let Some((nx, ny, nz)) = get_neighbor_coords(x, y, z, direction) else {
            continue; // Skip out-of-bounds neighbors
        };

        // Map direction from current tile's perspective to neighbor's perspective
        let neighbor_edge_dir = match direction {
            EdgeDirection::Left => EdgeDirection::Right, // West neighbor needs edge on their right
            EdgeDirection::Right => EdgeDirection::Left, // East neighbor needs edge on their left
            EdgeDirection::Top => EdgeDirection::Bottom, // North neighbor needs edge on their bottom
            EdgeDirection::Bottom => EdgeDirection::Top, // South neighbor needs edge on their top
        };
        // Encode neighbor coordinates and check if tile exists
        let Some(neighbor_handle) = encode_quadleaf_handle((nx, ny, nz)) else {
            continue;
        };

        let Some(neighbor_tile) = qt.qt.get(neighbor_handle) else {
            continue; // Neighbor tile not loaded
        };

        // Get the first hillshade entity from neighbor (only support one hillshade per tile for now)
        let Some(neighbor_entity) = neighbor_tile
            .hillshade_entity_ids
            .as_ref()
            .and_then(|ids| ids.iter().find_map(|&id| id))
        else {
            continue; // Neighbor doesn't have hillshade
        };

        let Ok(neighbor_dr) = data_requesters.get(neighbor_entity) else {
            continue; // Neighbor hillshade entity not found in query
        };

        if !neighbor_dr.is_succeeded() {
            continue; // Neighbor not successfully loaded
        }

        // Opposite direction: edge direction on current tile that neighbor needs
        let opposite_dir = match neighbor_edge_dir {
            EdgeDirection::Left => EdgeDirection::Right,
            EdgeDirection::Right => EdgeDirection::Left,
            EdgeDirection::Top => EdgeDirection::Bottom,
            EdgeDirection::Bottom => EdgeDirection::Top,
        };

        // Current tile's edge -> neighbor
        if let Some(edge_for_neighbor) =
            get_edge_from_tile(entity, opposite_dir, extracted_edges, edges_query, buf)
        {
            edges_to_store.push((
                edge_for_neighbor,
                neighbor_handle,
                neighbor_entity,
                neighbor_edge_dir as u8,
            ));
        }

        // Neighbor's edge -> current tile
        let edge_for_current = if let Ok(neighbor_edges) = edges_query.get(neighbor_entity) {
            // Neighbor already has extracted edges stored, use them
            let edge_handle = match neighbor_edge_dir {
                EdgeDirection::Left => neighbor_edges.left,
                EdgeDirection::Right => neighbor_edges.right,
                EdgeDirection::Top => neighbor_edges.top,
                EdgeDirection::Bottom => neighbor_edges.bottom,
            };
            buf.get_u8(&edge_handle)
                .map(|b| b.to_vec())
                .unwrap_or_default()
        } else {
            // Neighbor loaded in the same frame: HillshadeEdges component not yet available
            // (inserted via commands, takes effect next frame), but original data still exists
            // (JS-side removeU8 is async). Extract edge from neighbor's original DEM data.
            buf.get_u8(&neighbor_dr.handle)
                .map(|bytes| extract_single_edge(bytes, neighbor_edge_dir))
                .unwrap_or_default()
        };

        if !edge_for_current.is_empty() {
            edges_to_store.push((edge_for_current, tile_handle, entity, opposite_dir as u8));
        }
    }

    edges_to_store
}

/// Store extracted edges in BufferStore
/// Original DEM data is deleted by JS side after processing the event
fn store_extracted_edges(
    entity: Entity,
    extracted_edges: ExtractedEdges,
    commands: &mut Commands,
    buf: &mut BufferStore,
) {
    // Store edges in BufferStore (4KB per tile)
    let left_handle = buf.new_u8(extracted_edges.left);
    let right_handle = buf.new_u8(extracted_edges.right);
    let top_handle = buf.new_u8(extracted_edges.top);
    let bottom_handle = buf.new_u8(extracted_edges.bottom);

    // Mark edges as extracted and store edge handles
    commands.entity(entity).insert((
        HillshadeEdgesExtracted,
        HillshadeEdges {
            left: left_handle,
            right: right_handle,
            top: top_handle,
            bottom: bottom_handle,
        },
    ));
}

/// Extract a single edge from original DEM texture based on direction
/// Returns edge data as Vec<u8> (content_size * 4 bytes RGBA)
fn extract_single_edge(src: &[u8], direction: EdgeDirection) -> Vec<u8> {
    if src.len() < 16 {
        // Too small to be a meaningful tile; treat as invalid.
        return Vec::new();
    }
    if !src.len().is_multiple_of(4) {
        // Not a multiple of 4 bytes; cannot be RGBA pixels.
        return Vec::new();
    }
    let pixels = src.len() / 4;
    let src_size = (pixels as f64).sqrt() as usize;
    // Require perfect square and a minimum side length (e.g. 4x4).
    if src_size < 4 || src_size * src_size * 4 != src.len() {
        // Unexpected tile shape/size; skip edge extraction.
        return Vec::new();
    }

    let mut edge = Vec::with_capacity(src_size * 4);

    match direction {
        EdgeDirection::Left => {
            // Left edge (x=0)
            for y in 0..src_size {
                let idx = (y * src_size) * 4;
                if idx + 4 <= src.len() {
                    edge.extend_from_slice(&src[idx..idx + 4]);
                }
            }
        }
        EdgeDirection::Right => {
            // Right edge (x=src_size-1)
            for y in 0..src_size {
                let idx = (y * src_size + (src_size - 1)) * 4;
                if idx + 4 <= src.len() {
                    edge.extend_from_slice(&src[idx..idx + 4]);
                }
            }
        }
        EdgeDirection::Top => {
            // Top edge (y=0)
            for x in 0..src_size {
                let idx = x * 4;
                if idx + 4 <= src.len() {
                    edge.extend_from_slice(&src[idx..idx + 4]);
                }
            }
        }
        EdgeDirection::Bottom => {
            // Bottom edge (y=src_size-1)
            for x in 0..src_size {
                let idx = ((src_size - 1) * src_size + x) * 4;
                if idx + 4 <= src.len() {
                    edge.extend_from_slice(&src[idx..idx + 4]);
                }
            }
        }
    }

    edge
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Helper to create a test texture with unique values per pixel
    fn create_test_texture(size: usize) -> Vec<u8> {
        let mut buffer = vec![0u8; size * size * 4];
        for y in 0..size {
            for x in 0..size {
                let idx = (y * size + x) * 4;
                buffer[idx] = x as u8; // R
                buffer[idx + 1] = y as u8; // G
                buffer[idx + 2] = (x + y) as u8; // B
                buffer[idx + 3] = 255; // A
            }
        }
        buffer
    }

    #[test]
    fn test_extract_single_edge() {
        let size = 256;
        let texture = create_test_texture(size);

        // Test left edge (x=0)
        let left_edge = extract_single_edge(&texture, EdgeDirection::Left);
        assert_eq!(
            left_edge.len(),
            size * 4,
            "Left edge should be {} bytes",
            size * 4
        );
        for y in 0..size {
            let expected_r = 0; // x=0
            let expected_g = y as u8;
            assert_eq!(left_edge[y * 4], expected_r);
            assert_eq!(left_edge[y * 4 + 1], expected_g);
        }

        // Test right edge (x=255)
        let right_edge = extract_single_edge(&texture, EdgeDirection::Right);
        assert_eq!(
            right_edge.len(),
            size * 4,
            "Right edge should be {} bytes",
            size * 4
        );
        for y in 0..size {
            let expected_r = (size - 1) as u8;
            let expected_g = y as u8;
            assert_eq!(right_edge[y * 4], expected_r);
            assert_eq!(right_edge[y * 4 + 1], expected_g);
        }

        // Test top edge (y=0)
        let top_edge = extract_single_edge(&texture, EdgeDirection::Top);
        assert_eq!(
            top_edge.len(),
            size * 4,
            "Top edge should be {} bytes",
            size * 4
        );
        for x in 0..size {
            let expected_r = x as u8;
            let expected_g = 0; // y=0
            assert_eq!(top_edge[x * 4], expected_r);
            assert_eq!(top_edge[x * 4 + 1], expected_g);
        }

        // Test bottom edge (y=255)
        let bottom_edge = extract_single_edge(&texture, EdgeDirection::Bottom);
        assert_eq!(
            bottom_edge.len(),
            size * 4,
            "Bottom edge should be {} bytes",
            size * 4
        );
        for x in 0..size {
            let expected_r = x as u8;
            let expected_g = (size - 1) as u8;
            assert_eq!(bottom_edge[x * 4], expected_r);
            assert_eq!(bottom_edge[x * 4 + 1], expected_g);
        }
    }

    #[test]
    fn test_extract_single_edge_small_texture() {
        // Test with a smaller texture to verify logic
        let size = 4;
        let texture = create_test_texture(size);

        // Left edge should be [(0,0), (0,1), (0,2), (0,3)]
        let left_edge = extract_single_edge(&texture, EdgeDirection::Left);
        assert_eq!(left_edge.len(), size * 4);
        for y in 0..size {
            assert_eq!(left_edge[y * 4], 0); // x=0
            assert_eq!(left_edge[y * 4 + 1], y as u8); // y
        }

        // Right edge should be [(3,0), (3,1), (3,2), (3,3)]
        let right_edge = extract_single_edge(&texture, EdgeDirection::Right);
        for y in 0..size {
            assert_eq!(right_edge[y * 4], 3); // x=3
            assert_eq!(right_edge[y * 4 + 1], y as u8); // y
        }
    }
}
