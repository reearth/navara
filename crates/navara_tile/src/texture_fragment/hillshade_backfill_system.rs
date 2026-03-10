use bevy_ecs::{
    component::Component,
    entity::Entity,
    query::{Changed, With},
    system::{Commands, Query, ResMut},
};
use navara_buffer_store::BufferStore;
use navara_data_requester::{DataRequester, DataRequesterStatus};
use navara_event_store::EventStore;
use navara_tile_component::{RasterTileQuadtree, TileTextureFragmentMarker};

use crate::dem_backfill::backfill_dem_texture;

/// Marker component to identify hillshade DEM texture requests
/// This distinguishes hillshade DataRequesters from other types
#[derive(Debug, Clone, Copy, Component)]
pub struct HillshadeTextureMarker;

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
    qt: ResMut<RasterTileQuadtree>,
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
    mut existing_backfills: Query<(Entity, &mut HillshadeDEMState, &TileTextureFragmentMarker)>,
) {
    use navara_quadtree::{decode_quadleaf_handle, encode_quadleaf_handle};

    for (entity, data_req, marker) in query.iter() {
        // Only process successfully loaded hillshade DataRequesters
        if data_req.status != DataRequesterStatus::Success {
            continue;
        }

        let tile_handle = marker.0;

        // Perform backfill
        if let Some(backfilled_handle) = backfill_dem_texture(
            &qt,
            &mut buf,
            tile_handle,
            data_req.handle,
            &all_data_requesters,
        ) {
            // Store state on the entity
            commands.entity(entity).insert(HillshadeDEMState {
                original_handle: data_req.handle,
                backfilled_handle,
            });

            // Notify JS that backfill is complete and texture data is ready
            events
                .hillshade_backfilled
                .push((entity, backfilled_handle, tile_handle));

            // Bidirectional backfill: Update neighbors' padding with current tile's edge data
            // This ensures seamless transitions between tiles
            let (x, y, z): (usize, usize, usize) = decode_quadleaf_handle(tile_handle);
            let neighbors: [((usize, usize, usize), usize); 4] = [
                ((x.wrapping_sub(1), y, z), 0), // West neighbor, direction 0 (update their right edge)
                ((x + 1, y, z), 1), // East neighbor, direction 1 (update their left edge)
                ((x, y.wrapping_sub(1), z), 2), // North neighbor, direction 2 (update their bottom edge)
                ((x, y + 1, z), 3), // South neighbor, direction 3 (update their top edge)
            ];

            // Clone current tile's data to avoid borrow conflicts
            if let Some(current_bytes) = buf.get_u8(&backfilled_handle) {
                let current_bytes_cloned = current_bytes.to_vec();

                for ((nx, ny, nz), direction) in neighbors {
                    if let Some(neighbor_handle) = encode_quadleaf_handle((nx, ny, nz)) {
                        // Find neighbor's existing backfilled buffer
                        for (_neighbor_entity, neighbor_state, neighbor_marker) in
                            existing_backfills.iter_mut()
                        {
                            if neighbor_marker.0 == neighbor_handle {
                                // Update neighbor's padding with current tile's edge
                                // Note: This updates the buffer data for future texture loads,
                                // but doesn't affect already-created DataTextures (they copied the bytes).
                                // Seams will be eliminated when neighbor's texture reloads or mesh updates.
                                if let Some(neighbor_bytes) =
                                    buf.get_u8_mut(&neighbor_state.backfilled_handle)
                                {
                                    copy_edge_bidirectional(
                                        neighbor_bytes,
                                        &current_bytes_cloned,
                                        direction,
                                    );
                                    // No event needed - buffer update doesn't affect existing DataTextures
                                }
                                break;
                            }
                        }
                    }
                }
            }
        }
    }
}

/// Copy edge data from source to destination's padding (for bidirectional backfill)
/// direction: 0=update dst's right edge, 1=left, 2=bottom, 3=top
fn copy_edge_bidirectional(dst: &mut [u8], src: &[u8], direction: usize) {
    let dst_size = ((dst.len() / 4) as f64).sqrt() as usize;
    let src_size = ((src.len() / 4) as f64).sqrt() as usize;
    let content_size = dst_size - 2; // Assuming both are padded (258x258)

    match direction {
        0 => {
            // Update dst's right padding (x=content_size+1) from src's left edge (x=1)
            for y in 0..content_size {
                let src_x = 1; // src's left edge (first content pixel)
                let src_y = y + 1;
                let src_idx = (src_y * src_size + src_x) * 4;

                let dst_x = content_size + 1; // dst's right padding
                let dst_y = y + 1;
                let dst_idx = (dst_y * dst_size + dst_x) * 4;

                if src_idx + 4 <= src.len() && dst_idx + 4 <= dst.len() {
                    dst[dst_idx..dst_idx + 4].copy_from_slice(&src[src_idx..src_idx + 4]);
                }
            }
        }
        1 => {
            // Update dst's left padding (x=0) from src's right edge (x=content_size)
            for y in 0..content_size {
                let src_x = content_size; // src's right edge (last content pixel)
                let src_y = y + 1;
                let src_idx = (src_y * src_size + src_x) * 4;

                let dst_x = 0; // dst's left padding
                let dst_y = y + 1;
                let dst_idx = (dst_y * dst_size + dst_x) * 4;

                if src_idx + 4 <= src.len() && dst_idx + 4 <= dst.len() {
                    dst[dst_idx..dst_idx + 4].copy_from_slice(&src[src_idx..src_idx + 4]);
                }
            }
        }
        2 => {
            // Update dst's bottom padding (y=content_size+1) from src's top edge (y=1)
            for x in 0..content_size {
                let src_x = x + 1;
                let src_y = 1; // src's top edge
                let src_idx = (src_y * src_size + src_x) * 4;

                let dst_x = x + 1;
                let dst_y = content_size + 1; // dst's bottom padding
                let dst_idx = (dst_y * dst_size + dst_x) * 4;

                if src_idx + 4 <= src.len() && dst_idx + 4 <= dst.len() {
                    dst[dst_idx..dst_idx + 4].copy_from_slice(&src[src_idx..src_idx + 4]);
                }
            }
        }
        3 => {
            // Update dst's top padding (y=0) from src's bottom edge (y=content_size)
            for x in 0..content_size {
                let src_x = x + 1;
                let src_y = content_size; // src's bottom edge
                let src_idx = (src_y * src_size + src_x) * 4;

                let dst_x = x + 1;
                let dst_y = 0; // dst's top padding
                let dst_idx = (dst_y * dst_size + dst_x) * 4;

                if src_idx + 4 <= src.len() && dst_idx + 4 <= dst.len() {
                    dst[dst_idx..dst_idx + 4].copy_from_slice(&src[src_idx..src_idx + 4]);
                }
            }
        }
        _ => {}
    }
}
