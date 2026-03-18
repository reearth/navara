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
use navara_tile_component::{HillshadeBackfillEventData, HillshadeBackfillEvents};
use navara_tile_component::{RasterTileQuadtree, TileTextureFragmentMarker};

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

/// System that runs after DataRequester loads hillshade DEM data
/// Sends edge data to JS for texture edge updates
#[allow(clippy::type_complexity)]
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
        Entity,
        &DataRequester,
        &TileTextureFragmentMarker,
        &HillshadeTextureMarker,
    )>,
) {
    for (entity, data_req, marker) in query.iter() {
        // Only process successfully loaded hillshade DataRequesters
        if data_req.status != DataRequesterStatus::Success {
            continue;
        }

        let tile_handle = marker.0;
        let (x, y, z): (usize, usize, usize) = decode_quadleaf_handle(tile_handle);

        // Collect all events for this entity in a Vec
        let mut event_data_list = Vec::new();

        // 1. First event: initialization with original data
        // This creates the DataTexture in JS
        event_data_list.push(HillshadeBackfillEventData {
            tile_handle,
            edge_data_handle: -1, // No edge data for initial creation
            original_handle: Some(data_req.handle),
            target_entity: None, // Not needed for initialization (uses event's own entity)
            edge_direction: 255, // N/A for initialization
        });

        // Get current tile's DEM data (256x256 RGBA)
        // Clone to avoid borrow checker issues when we need to mutate buf later
        let Some(current_bytes) = buf.get_u8(&data_req.handle).map(|b| b.to_vec()) else {
            continue;
        };

        // Check 4 neighbors and update their edges
        let neighbors: [(usize, usize, usize, EdgeDirection); 4] = [
            (x.wrapping_sub(1), y, z, EdgeDirection::Right), // West neighbor needs our left edge on their right
            (x + 1, y, z, EdgeDirection::Left), // East neighbor needs our right edge on their left
            (x, y.wrapping_sub(1), z, EdgeDirection::Bottom), // North neighbor needs our top edge on their bottom
            (x, y + 1, z, EdgeDirection::Top), // South neighbor needs our bottom edge on their top
        ];

        for (nx, ny, nz, direction) in neighbors {
            if let Some(neighbor_handle) = encode_quadleaf_handle((nx, ny, nz))
                && qt.qt.get(neighbor_handle).is_some()
            {
                // Find neighbor's DataRequester entity
                if let Some((neighbor_entity, neighbor_dr, _, _)) = all_data_requesters
                    .iter()
                    .find(|(_, _, m, _)| m.0 == neighbor_handle)
                {
                    // Only update if neighbor is successfully loaded
                    if neighbor_dr.status == DataRequesterStatus::Success {
                        // Event for neighbor (current tile's edge -> neighbor)
                        // direction is where to update on the neighbor, we need the opposite edge from current tile
                        let opposite_dir = match direction {
                            EdgeDirection::Left => EdgeDirection::Right,
                            EdgeDirection::Right => EdgeDirection::Left,
                            EdgeDirection::Top => EdgeDirection::Bottom,
                            EdgeDirection::Bottom => EdgeDirection::Top,
                        };
                        let edge_for_neighbor = extract_single_edge(&current_bytes, opposite_dir);
                        let edge_handle = buf.new_u8(edge_for_neighbor);

                        event_data_list.push(HillshadeBackfillEventData {
                            tile_handle: neighbor_handle,
                            edge_data_handle: edge_handle,
                            original_handle: None,
                            target_entity: Some(neighbor_entity),
                            edge_direction: direction as u8,
                        });

                        // Event for current tile (neighbor's edge -> current)
                        if let Some(neighbor_bytes) =
                            buf.get_u8(&neighbor_dr.handle).map(|b| b.to_vec())
                        {
                            // direction is what we update on neighbor, same edge from neighbor updates the opposite on current
                            // For West neighbor (direction=Right): neighbor's Right edge -> current's Left edge
                            let edge_for_current = extract_single_edge(&neighbor_bytes, direction);
                            let edge_handle = buf.new_u8(edge_for_current);

                            event_data_list.push(HillshadeBackfillEventData {
                                tile_handle,
                                edge_data_handle: edge_handle,
                                original_handle: None,
                                target_entity: Some(entity),
                                edge_direction: opposite_dir as u8,
                            });
                        }
                    }
                }
            }
        }

        // Add all events to the entity and push to EventStore once
        commands.entity(entity).insert(HillshadeBackfillEvents {
            events: event_data_list,
        });
        events.hillshade_backfilled.push(entity);
    }
}

/// Edge direction for hillshade texture updates
#[derive(Debug, Clone, Copy)]
enum EdgeDirection {
    Left = 0,
    Right = 1,
    Top = 2,
    Bottom = 3,
}

/// Extract a single edge from original DEM texture based on direction
/// Returns edge data as Vec<u8> (content_size * 4 bytes RGBA)
fn extract_single_edge(src: &[u8], direction: EdgeDirection) -> Vec<u8> {
    let src_size = ((src.len() / 4) as f64).sqrt() as usize;
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
