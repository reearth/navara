use bevy_ecs::{component::Component, system::Query};
use navara_buffer_store::{BufferStore, Handle};
use navara_data_requester::DataRequester;
use navara_quadtree::{decode_quadleaf_handle, encode_quadleaf_handle};
use navara_tile_component::{RasterTileQuadtree, TileHandle, TileTextureFragmentMarker};

/// Direction for DEM border backfill
/// For initial backfill: indicates which border of the current tile to fill
/// For bidirectional backfill: indicates which border of the neighbor tile to update
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BackfillDirection {
    Left = 0,
    Right = 1,
    Top = 2,
    Bottom = 3,
}

/// Backfill DEM texture borders from neighbor tiles
///
/// This function:
/// 1. Expands the original 256×256 DEM texture to 258×258 with 1-pixel padding
/// 2. Copies the central content
/// 3. Tries to fill borders from 4 neighboring tiles (prefers backfilled if available)
/// 4. Falls back to edge replication if neighbors are not loaded
///
/// Returns the handle to the new padded buffer (258×258×4 bytes)
pub fn backfill_dem_texture<F: Component>(
    qt: &RasterTileQuadtree,
    buf: &mut BufferStore,
    tile_handle: TileHandle,
    dem_buffer_handle: Handle,
    data_requesters: &Query<(&DataRequester, &TileTextureFragmentMarker, &F)>,
    backfilled_handle_lookup: &dyn Fn(TileHandle) -> Option<Handle>,
) -> Option<Handle> {
    let (x, y, z): (usize, usize, usize) = decode_quadleaf_handle(tile_handle);

    // Get current tile's RGBA data
    let bytes = buf.get_u8(&dem_buffer_handle)?;
    let size = ((bytes.len() / 4) as f64).sqrt() as usize;

    // Create new padded buffer: (size+2)^2 * 4
    let padded_size = size + 2;
    let mut padded_bytes = vec![0u8; padded_size * padded_size * 4];

    // Copy center content: original [0..size, 0..size] → padded [1..size+1, 1..size+1]
    for row in 0..size {
        for col in 0..size {
            let src_idx = (row * size + col) * 4;
            let dst_idx = ((row + 1) * padded_size + (col + 1)) * 4;
            padded_bytes[dst_idx..dst_idx + 4].copy_from_slice(&bytes[src_idx..src_idx + 4]);
        }
    }

    // First, fill all padding with own edges as fallback
    // This ensures valid data even if neighbors are missing
    replicate_edges(&mut padded_bytes, padded_size);

    // Then try to backfill borders from 4 neighbors (will overwrite fallback data)
    // Note: In tile coordinates, y increases downward (south)
    // In texture arrays, y=0 is the first row (north/top)
    let neighbors = [
        (x.wrapping_sub(1), y, z, BackfillDirection::Left), // West
        (x + 1, y, z, BackfillDirection::Right),            // East
        (x, y.wrapping_sub(1), z, BackfillDirection::Top),  // North (y-1, geographic top)
        (x, y + 1, z, BackfillDirection::Bottom),           // South (y+1, geographic bottom)
    ];

    for (nx, ny, nz, direction) in neighbors {
        if let Some(neighbor_handle) = encode_quadleaf_handle((nx, ny, nz))
            && qt.qt.get(neighbor_handle).is_some()
            && let Some(neighbor_dem_handle) =
                get_neighbor_dem_handle(neighbor_handle, data_requesters, backfilled_handle_lookup)
            && let Some(neighbor_bytes) = buf.get_u8(&neighbor_dem_handle)
        {
            // Overwrite the fallback data with real neighbor data
            copy_border(&mut padded_bytes, neighbor_bytes, size, direction);
        }
    }

    // Store the new padded buffer and return handle
    Some(buf.new_u8(padded_bytes))
}

/// Try to find the DEM buffer handle from a neighbor tile
/// Prefers backfilled handle (258x258 with padding) if available,
/// otherwise returns original handle (256x256) from DataRequester
fn get_neighbor_dem_handle<F: Component>(
    neighbor_handle: TileHandle,
    data_requesters: &Query<(&DataRequester, &TileTextureFragmentMarker, &F)>,
    backfilled_handle_lookup: &dyn Fn(TileHandle) -> Option<Handle>,
) -> Option<Handle> {
    use navara_data_requester::DataRequesterStatus;

    // First, try to get backfilled handle (preferred, as it has padding)
    if let Some(backfilled_handle) = backfilled_handle_lookup(neighbor_handle) {
        return Some(backfilled_handle);
    }

    // Fallback: Search for original DataRequester handle
    for (data_req, marker, _) in data_requesters.iter() {
        if marker.0 == neighbor_handle {
            // Only use neighbor's data if it has been successfully loaded
            // This prevents using incomplete/pending data for backfill
            if data_req.status == DataRequesterStatus::Success {
                return Some(data_req.handle);
            } else {
                // Neighbor found but not ready yet, return None to use edge replication
                return None;
            }
        }
    }
    None
}

/// Copy border from neighbor tile to destination tile's padding
fn copy_border(dst: &mut [u8], src: &[u8], content_size: usize, direction: BackfillDirection) {
    let padded_size = content_size + 2;
    let src_size = ((src.len() / 4) as f64).sqrt() as usize;

    // If source is already padded, use content area; otherwise use full size
    let src_is_padded = src_size == padded_size;
    let src_content_size = if src_is_padded {
        content_size
    } else {
        src_size
    };
    let src_offset = if src_is_padded { 1 } else { 0 };

    match direction {
        BackfillDirection::Left => {
            // Copy from neighbor's right edge (x=content_size-1) to dst's left padding (x=0)
            for y in 0..content_size {
                let src_x = src_offset + src_content_size - 1;
                let src_y = src_offset + y;
                let src_idx = (src_y * src_size + src_x) * 4;

                let dst_x = 0;
                let dst_y = y + 1;
                let dst_idx = (dst_y * padded_size + dst_x) * 4;

                if src_idx + 4 <= src.len() {
                    dst[dst_idx..dst_idx + 4].copy_from_slice(&src[src_idx..src_idx + 4]);
                }
            }
        }
        BackfillDirection::Right => {
            // Copy from neighbor's left edge (x=0) to dst's right padding (x=content_size+1)
            for y in 0..content_size {
                let src_x = src_offset;
                let src_y = src_offset + y;
                let src_idx = (src_y * src_size + src_x) * 4;

                let dst_x = content_size + 1;
                let dst_y = y + 1;
                let dst_idx = (dst_y * padded_size + dst_x) * 4;

                if src_idx + 4 <= src.len() {
                    dst[dst_idx..dst_idx + 4].copy_from_slice(&src[src_idx..src_idx + 4]);
                }
            }
        }
        BackfillDirection::Top => {
            // North neighbor (y-1): Copy from neighbor's south edge (last row) to dst's north padding (y=0)
            for x in 0..content_size {
                let src_x = src_offset + x;
                let src_y = src_offset + src_content_size - 1; // Last row of neighbor
                let src_idx = (src_y * src_size + src_x) * 4;

                let dst_x = x + 1;
                let dst_y = 0; // Top padding row
                let dst_idx = (dst_y * padded_size + dst_x) * 4;

                if src_idx + 4 <= src.len() {
                    dst[dst_idx..dst_idx + 4].copy_from_slice(&src[src_idx..src_idx + 4]);
                }
            }
        }
        BackfillDirection::Bottom => {
            // South neighbor (y+1): Copy from neighbor's north edge (first row) to dst's south padding (y=content_size+1)
            for x in 0..content_size {
                let src_x = src_offset + x;
                let src_y = src_offset; // First row of neighbor
                let src_idx = (src_y * src_size + src_x) * 4;

                let dst_x = x + 1;
                let dst_y = content_size + 1; // Bottom padding row
                let dst_idx = (dst_y * padded_size + dst_x) * 4;

                if src_idx + 4 <= src.len() {
                    dst[dst_idx..dst_idx + 4].copy_from_slice(&src[src_idx..src_idx + 4]);
                }
            }
        }
    }
}

/// Replicate edges to fill padding when neighbors are not available
/// This is a temporary fallback until all neighbors are loaded
fn replicate_edges(bytes: &mut [u8], padded_size: usize) {
    let content_size = padded_size - 2;

    // Top edge: copy from row 1 to row 0
    for x in 1..=content_size {
        let src_idx = (padded_size + x) * 4;
        let dst_idx = x * 4;
        bytes.copy_within(src_idx..src_idx + 4, dst_idx);
    }

    // Bottom edge: copy from row content_size to row content_size+1
    for x in 1..=content_size {
        let src_idx = (content_size * padded_size + x) * 4;
        let dst_idx = ((content_size + 1) * padded_size + x) * 4;
        bytes.copy_within(src_idx..src_idx + 4, dst_idx);
    }

    // Left edge: copy from col 1 to col 0
    for y in 1..=content_size {
        let src_idx = (y * padded_size + 1) * 4;
        let dst_idx = (y * padded_size) * 4;
        bytes.copy_within(src_idx..src_idx + 4, dst_idx);
    }

    // Right edge: copy from col content_size to col content_size+1
    for y in 1..=content_size {
        let src_idx = (y * padded_size + content_size) * 4;
        let dst_idx = (y * padded_size + (content_size + 1)) * 4;
        bytes.copy_within(src_idx..src_idx + 4, dst_idx);
    }

    // Corners: copy from adjacent content pixels
    // Top-left corner
    let src_idx = (padded_size + 1) * 4;
    let dst_idx = 0;
    bytes.copy_within(src_idx..src_idx + 4, dst_idx);

    // Top-right corner
    let src_idx = (padded_size + content_size) * 4;
    let dst_idx = (content_size + 1) * 4;
    bytes.copy_within(src_idx..src_idx + 4, dst_idx);

    // Bottom-left corner
    let src_idx = (content_size * padded_size + 1) * 4;
    let dst_idx = ((content_size + 1) * padded_size) * 4;
    bytes.copy_within(src_idx..src_idx + 4, dst_idx);

    // Bottom-right corner
    let src_idx = (content_size * padded_size + content_size) * 4;
    let dst_idx = ((content_size + 1) * padded_size + (content_size + 1)) * 4;
    bytes.copy_within(src_idx..src_idx + 4, dst_idx);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_replicate_edges() {
        // 4×4 content → 6×6 padded
        let padded_size = 6;
        let mut bytes = vec![0u8; padded_size * padded_size * 4];

        // Fill center with test pattern (4×4 content at [1..5, 1..5])
        for y in 1..5 {
            for x in 1..5 {
                let idx = (y * padded_size + x) * 4;
                bytes[idx] = (x * 10 + y) as u8; // R channel
            }
        }

        replicate_edges(&mut bytes, padded_size);

        // Check top edge (y=0) matches row 1
        for x in 1..5 {
            let src_idx = (padded_size + x) * 4;
            let dst_idx = x * 4;
            assert_eq!(bytes[dst_idx], bytes[src_idx]);
        }

        // Check left edge (x=0) matches col 1
        for y in 1..5 {
            let src_idx = (y * padded_size + 1) * 4;
            let dst_idx = (y * padded_size) * 4;
            assert_eq!(bytes[dst_idx], bytes[src_idx]);
        }
    }

    /// Helper to create a test texture filled with a specific value
    fn create_test_texture(size: usize, value: u8) -> Vec<u8> {
        vec![value; size * size * 4]
    }

    /// Helper to create a test texture with unique values per pixel
    fn create_pattern_texture(size: usize) -> Vec<u8> {
        let mut bytes = vec![0u8; size * size * 4];
        for y in 0..size {
            for x in 0..size {
                let idx = (y * size + x) * 4;
                bytes[idx] = (x + y * 10) as u8; // Unique R value per pixel
                bytes[idx + 1] = (x + y) as u8; // G channel
                bytes[idx + 2] = 255; // B channel
                bytes[idx + 3] = 255; // A channel
            }
        }
        bytes
    }

    #[test]
    fn test_copy_border_left_from_unpadded_neighbor() {
        // Destination: 4×4 content → 6×6 padded
        let content_size = 4;
        let padded_size = content_size + 2;
        let mut dst = vec![0u8; padded_size * padded_size * 4];

        // Source: unpadded 4×4 (neighbor to the west)
        let src_size = 4;
        let src = create_pattern_texture(src_size);

        copy_border(&mut dst, &src, content_size, BackfillDirection::Left);

        // Verify: dst's left padding (x=0) should have neighbor's right edge (x=3)
        for y in 0..content_size {
            let src_right_edge_idx = (y * src_size + (src_size - 1)) * 4; // Right edge of src (x=3)
            let dst_left_padding_idx = ((y + 1) * padded_size) * 4; // Left padding of dst (x=0)

            assert_eq!(
                dst[dst_left_padding_idx], src[src_right_edge_idx],
                "Left border mismatch at y={}",
                y
            );
        }
    }

    #[test]
    fn test_copy_border_right_from_padded_neighbor() {
        // Destination: 4×4 content → 6×6 padded
        let content_size = 4;
        let padded_size = content_size + 2;
        let mut dst = vec![0u8; padded_size * padded_size * 4];

        // Source: padded 6×6 (neighbor to the east, already backfilled)
        let src_padded_size = 6; // 4 + 2
        let src = create_pattern_texture(src_padded_size);

        copy_border(&mut dst, &src, content_size, BackfillDirection::Right);

        // Verify: dst's right padding (x=5) should have neighbor's left content edge (x=1)
        for y in 0..content_size {
            let src_left_content_idx = ((y + 1) * src_padded_size + 1) * 4; // Left content of padded src (x=1, y+1)
            let dst_right_padding_idx = ((y + 1) * padded_size + (content_size + 1)) * 4; // Right padding (x=5)

            assert_eq!(
                dst[dst_right_padding_idx], src[src_left_content_idx],
                "Right border mismatch at y={}",
                y
            );
        }
    }

    #[test]
    fn test_copy_border_top_from_unpadded_neighbor() {
        // Destination: 4×4 content → 6×6 padded
        let content_size = 4;
        let padded_size = content_size + 2;
        let mut dst = vec![0u8; padded_size * padded_size * 4];

        // Source: unpadded 4×4 (neighbor to the north, y-1)
        let src_size = 4;
        let src = create_pattern_texture(src_size);

        copy_border(&mut dst, &src, content_size, BackfillDirection::Top);

        // Verify: dst's top padding (y=0) should have neighbor's bottom edge (y=3)
        for x in 0..content_size {
            let src_bottom_edge_idx = ((src_size - 1) * src_size + x) * 4; // Bottom edge of src (y=3)
            let dst_top_padding_idx = (x + 1) * 4; // Top padding (y=0, x+1)

            assert_eq!(
                dst[dst_top_padding_idx], src[src_bottom_edge_idx],
                "Top border mismatch at x={}",
                x
            );
        }
    }

    #[test]
    fn test_copy_border_bottom_from_padded_neighbor() {
        // Destination: 4×4 content → 6×6 padded
        let content_size = 4;
        let padded_size = content_size + 2;
        let mut dst = vec![0u8; padded_size * padded_size * 4];

        // Source: padded 6×6 (neighbor to the south, y+1, already backfilled)
        let src_padded_size = 6; // 4 + 2
        let src = create_pattern_texture(src_padded_size);

        copy_border(&mut dst, &src, content_size, BackfillDirection::Bottom);

        // Verify: dst's bottom padding (y=5) should have neighbor's top content edge (y=1)
        for x in 0..content_size {
            let src_top_content_idx = (src_padded_size + (x + 1)) * 4; // Top content of padded src (y=1, x+1)
            let dst_bottom_padding_idx = ((content_size + 1) * padded_size + (x + 1)) * 4; // Bottom padding (y=5)

            assert_eq!(
                dst[dst_bottom_padding_idx], src[src_top_content_idx],
                "Bottom border mismatch at x={}",
                x
            );
        }
    }

    #[test]
    fn test_copy_border_all_directions() {
        // Test that all 4 directions work correctly in combination
        let content_size = 4;
        let padded_size = content_size + 2;
        let mut dst = vec![0u8; padded_size * padded_size * 4];

        // Create 4 distinct neighbors with different patterns
        let left_neighbor = create_test_texture(4, 10); // West neighbor: all 10
        let right_neighbor = create_test_texture(4, 20); // East neighbor: all 20
        let top_neighbor = create_test_texture(4, 30); // North neighbor: all 30
        let bottom_neighbor = create_test_texture(4, 40); // South neighbor: all 40

        // Apply all borders
        copy_border(
            &mut dst,
            &left_neighbor,
            content_size,
            BackfillDirection::Left,
        );
        copy_border(
            &mut dst,
            &right_neighbor,
            content_size,
            BackfillDirection::Right,
        );
        copy_border(
            &mut dst,
            &top_neighbor,
            content_size,
            BackfillDirection::Top,
        );
        copy_border(
            &mut dst,
            &bottom_neighbor,
            content_size,
            BackfillDirection::Bottom,
        );

        // Verify each border has correct values
        // Left padding (x=0)
        for y in 1..=content_size {
            let idx = (y * padded_size) * 4;
            assert_eq!(dst[idx], 10, "Left border failed at y={}", y);
        }

        // Right padding (x=5)
        for y in 1..=content_size {
            let idx = (y * padded_size + (content_size + 1)) * 4;
            assert_eq!(dst[idx], 20, "Right border failed at y={}", y);
        }

        // Top padding (y=0)
        for x in 1..=content_size {
            let idx = x * 4;
            assert_eq!(dst[idx], 30, "Top border failed at x={}", x);
        }

        // Bottom padding (y=5)
        for x in 1..=content_size {
            let idx = ((content_size + 1) * padded_size + x) * 4;
            assert_eq!(dst[idx], 40, "Bottom border failed at x={}", x);
        }
    }

    #[test]
    fn test_backfill_logic_without_neighbors() {
        // End-to-end test of the backfill logic without ECS dependencies
        // This simulates what backfill_dem_texture does when no neighbors are available

        // Create a simple 4×4 DEM with unique values
        let original_size = 4;
        let mut original_dem = vec![0u8; original_size * original_size * 4];
        for y in 0..original_size {
            for x in 0..original_size {
                let idx = (y * original_size + x) * 4;
                original_dem[idx] = (x + y * 10) as u8; // Unique R value
                original_dem[idx + 1] = x as u8; // G channel
                original_dem[idx + 2] = y as u8; // B channel
                original_dem[idx + 3] = 255; // A channel
            }
        }

        // Simulate backfill_dem_texture logic
        let padded_size = original_size + 2;
        let mut padded_bytes = vec![0u8; padded_size * padded_size * 4];

        // Step 1: Copy center content
        for row in 0..original_size {
            for col in 0..original_size {
                let src_idx = (row * original_size + col) * 4;
                let dst_idx = ((row + 1) * padded_size + (col + 1)) * 4;
                padded_bytes[dst_idx..dst_idx + 4]
                    .copy_from_slice(&original_dem[src_idx..src_idx + 4]);
            }
        }

        // Step 2: Replicate edges (fallback when no neighbors)
        replicate_edges(&mut padded_bytes, padded_size);

        // Verify size
        let expected_size = padded_size * padded_size * 4;
        assert_eq!(padded_bytes.len(), expected_size);

        // Verify center content is preserved
        for y in 0..original_size {
            for x in 0..original_size {
                let src_idx = (y * original_size + x) * 4;
                let dst_idx = ((y + 1) * padded_size + (x + 1)) * 4;
                assert_eq!(
                    padded_bytes[dst_idx..dst_idx + 4],
                    original_dem[src_idx..src_idx + 4],
                    "Content mismatch at ({}, {})",
                    x,
                    y
                );
            }
        }

        // Verify edges are replicated correctly
        // Left edge (x=0) should match first content column (x=1)
        for y in 0..original_size {
            let content_idx = ((y + 1) * padded_size + 1) * 4;
            let padding_idx = ((y + 1) * padded_size) * 4;
            assert_eq!(
                padded_bytes[padding_idx..padding_idx + 4],
                padded_bytes[content_idx..content_idx + 4],
                "Left edge replication failed at y={}",
                y
            );
        }

        // Top edge (y=0) should match first content row (y=1)
        for x in 0..original_size {
            let content_idx = (padded_size + (x + 1)) * 4;
            let padding_idx = (x + 1) * 4;
            assert_eq!(
                padded_bytes[padding_idx..padding_idx + 4],
                padded_bytes[content_idx..content_idx + 4],
                "Top edge replication failed at x={}",
                x
            );
        }

        // Verify corners are filled
        let top_left_corner = padded_bytes[0];
        let top_left_content = padded_bytes[(padded_size + 1) * 4];
        assert_eq!(
            top_left_corner, top_left_content,
            "Top-left corner should match (1,1) content"
        );
    }

    #[test]
    fn test_backfill_with_neighbor_data() {
        // End-to-end test: verify that copy_border correctly integrates neighbor data
        let original_size = 4;
        let padded_size = original_size + 2;

        // Create current tile (all pixels = 50)
        let current_tile = vec![50u8; original_size * original_size * 4];

        // Create neighbors with distinct values
        let west_neighbor = vec![10u8; original_size * original_size * 4]; // Left neighbor
        let east_neighbor = vec![20u8; original_size * original_size * 4]; // Right neighbor
        let north_neighbor = vec![30u8; original_size * original_size * 4]; // Top neighbor
        let south_neighbor = vec![40u8; original_size * original_size * 4]; // Bottom neighbor

        // Simulate backfill process
        let mut padded_bytes = vec![0u8; padded_size * padded_size * 4];

        // Copy center
        for row in 0..original_size {
            for col in 0..original_size {
                let src_idx = (row * original_size + col) * 4;
                let dst_idx = ((row + 1) * padded_size + (col + 1)) * 4;
                padded_bytes[dst_idx..dst_idx + 4]
                    .copy_from_slice(&current_tile[src_idx..src_idx + 4]);
            }
        }

        // Apply edge replication as fallback
        replicate_edges(&mut padded_bytes, padded_size);

        // Apply neighbor borders (should overwrite replicated edges)
        copy_border(
            &mut padded_bytes,
            &west_neighbor,
            original_size,
            BackfillDirection::Left,
        );
        copy_border(
            &mut padded_bytes,
            &east_neighbor,
            original_size,
            BackfillDirection::Right,
        );
        copy_border(
            &mut padded_bytes,
            &north_neighbor,
            original_size,
            BackfillDirection::Top,
        );
        copy_border(
            &mut padded_bytes,
            &south_neighbor,
            original_size,
            BackfillDirection::Bottom,
        );

        // Verify center is unchanged (still 50)
        for y in 1..=original_size {
            for x in 1..=original_size {
                let idx = (y * padded_size + x) * 4;
                assert_eq!(padded_bytes[idx], 50, "Center modified at ({}, {})", x, y);
            }
        }

        // Verify borders have neighbor data
        // Left border should be 10 (west neighbor's right edge)
        for y in 1..=original_size {
            let idx = (y * padded_size) * 4;
            assert_eq!(padded_bytes[idx], 10, "Left border wrong at y={}", y);
        }

        // Right border should be 20 (east neighbor's left edge)
        for y in 1..=original_size {
            let idx = (y * padded_size + (original_size + 1)) * 4;
            assert_eq!(padded_bytes[idx], 20, "Right border wrong at y={}", y);
        }

        // Top border should be 30 (north neighbor's bottom edge)
        for x in 1..=original_size {
            let idx = x * 4;
            assert_eq!(padded_bytes[idx], 30, "Top border wrong at x={}", x);
        }

        // Bottom border should be 40 (south neighbor's top edge)
        for x in 1..=original_size {
            let idx = ((original_size + 1) * padded_size + x) * 4;
            assert_eq!(padded_bytes[idx], 40, "Bottom border wrong at x={}", x);
        }

        // Corners should still be from edge replication (50) since neighbors don't fill corners
        // Actually, corners get filled by replicate_edges with content pixel values
        // But after neighbor copy, corners remain from edge replication (not overwritten)
    }
}
