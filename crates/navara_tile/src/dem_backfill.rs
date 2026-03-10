use bevy_ecs::{component::Component, system::Query};
use navara_buffer_store::{BufferStore, Handle};
use navara_data_requester::DataRequester;
use navara_quadtree::{decode_quadleaf_handle, encode_quadleaf_handle};
use navara_tile_component::{RasterTileQuadtree, TileHandle, TileTextureFragmentMarker};

/// Direction for DEM border backfill
#[derive(Debug, Clone, Copy)]
enum BackfillDirection {
    Left,
    Right,
    Top,
    Bottom,
}

/// Backfill DEM texture borders from neighbor tiles
///
/// This function:
/// 1. Expands the original 256×256 DEM texture to 258×258 with 1-pixel padding
/// 2. Copies the central content
/// 3. Tries to fill borders from 4 neighboring tiles
/// 4. Falls back to edge replication if neighbors are not loaded
///
/// Returns the handle to the new padded buffer (258×258×4 bytes)
pub fn backfill_dem_texture<F: Component>(
    qt: &RasterTileQuadtree,
    buf: &mut BufferStore,
    tile_handle: TileHandle,
    dem_buffer_handle: Handle,
    data_requesters: &Query<(&DataRequester, &TileTextureFragmentMarker, &F)>,
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
                get_neighbor_dem_handle(neighbor_handle, data_requesters)
            && let Some(neighbor_bytes) = buf.get_u8(&neighbor_dem_handle)
        {
            // Overwrite the fallback data with real neighbor data
            copy_border(&mut padded_bytes, neighbor_bytes, size, direction);
        }
    }

    // Store the new padded buffer and return handle
    Some(buf.new_u8(padded_bytes))
}

/// Try to find the DEM buffer handle from a neighbor tile using DataRequester query
/// This searches for a hillshade DataRequester component that references the neighbor tile
fn get_neighbor_dem_handle<F: Component>(
    neighbor_handle: TileHandle,
    data_requesters: &Query<(&DataRequester, &TileTextureFragmentMarker, &F)>,
) -> Option<Handle> {
    use navara_data_requester::DataRequesterStatus;

    // Search for hillshade DataRequester that belongs to the neighbor tile
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
}
