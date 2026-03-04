use guillotiere::Size;

use crate::resource::{GlyphMetrics, LRU_MIN_AGE, SDF_PX_SIZE, SDFAtlas};

/// Ensure all required glyphs (by glyph ID, post-shaping) are in the atlas.
///
/// For each glyph ID not yet in the atlas, rasterizes its SDF and packs it.
/// Updates LRU timestamps for all requested glyphs.
/// If the atlas is full, evicts the coldest unused glyphs before retrying.
pub fn ensure_glyphs_in_atlas(
    sdf_font: &fontsdf::Font,
    glyph_ids: &[u16],
    atlas: &mut SDFAtlas,
    current_frame: u64,
) -> bool {
    let mut new_glyphs = false;
    for &glyph_id in glyph_ids {
        // Always touch the glyph for LRU, even if already present
        atlas.touch(glyph_id, current_frame);

        if atlas.contains(glyph_id) {
            continue;
        }

        let (metrics, sdf_data) = sdf_font.rasterize_indexed_sdf(glyph_id, SDF_PX_SIZE);

        if metrics.width == 0 || metrics.height == 0 {
            continue;
        }

        let alloc_size = Size::new(metrics.width as i32, metrics.height as i32);

        // Try to allocate; if full, evict cold glyphs and retry
        let alloc = atlas.allocator.allocate(alloc_size).or_else(|| {
            evict_cold_glyphs(atlas, current_frame, LRU_MIN_AGE);
            atlas.allocator.allocate(alloc_size)
        });

        let Some(alloc) = alloc else {
            continue;
        };

        let rect = alloc.rectangle;
        let atlas_x = rect.min.x;
        let atlas_y = rect.min.y;

        // Copy single-channel SDF data into the atlas pixel buffer (R8 format)
        for y in (0..metrics.height).rev() {
            for x in 0..metrics.width {
                let src_idx = y * metrics.width + x;
                let dst_x = atlas_x as usize + x;
                let dst_y = atlas_y as usize + (metrics.height - 1 - y);
                let dst_idx = dst_y * atlas.width as usize + dst_x;

                if src_idx < sdf_data.len() && dst_idx < atlas.pixel_data.len() {
                    atlas.pixel_data[dst_idx] = sdf_data[src_idx];
                }
            }
        }

        atlas.glyph_map.insert(
            glyph_id,
            GlyphMetrics {
                alloc_id: alloc.id,
                atlas_x,
                atlas_y,
                atlas_w: metrics.width as u32,
                atlas_h: metrics.height as u32,
                bearing_x: metrics.xmin as f32,
                bearing_y: metrics.ymin as f32,
            },
        );
        new_glyphs = true;
    }
    new_glyphs
}

/// Evict glyphs that haven't been used for at least `min_age` frames.
///
/// Frees atlas space by deallocating the coldest glyphs first.
fn evict_cold_glyphs(atlas: &mut SDFAtlas, current_frame: u64, min_age: u64) {
    let evictable: Vec<(u16, u64)> = atlas
        .last_used
        .iter()
        .filter_map(|(&glyph_id, &last_frame)| {
            if current_frame.saturating_sub(last_frame) >= min_age {
                Some((glyph_id, last_frame))
            } else {
                None
            }
        })
        .collect();

    // Sort by last_used ascending (coldest first)
    // evictable.sort_by_key(|&(_, frame)| frame); // not necessary since we just want to evict all that are old enough

    for (glyph_id, _) in evictable {
        if let Some(metrics) = atlas.glyph_map.remove(&glyph_id) {
            atlas.allocator.deallocate(metrics.alloc_id);
            atlas.last_used.remove(&glyph_id);
        }
    }
}
