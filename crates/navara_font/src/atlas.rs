use guillotiere::Size;
use sdf_glyph_renderer::{clamp_to_u8, BitmapGlyph};

use crate::resource::{GlyphMetrics, LRU_MIN_AGE, SDF_PX_SIZE, SDFAtlas};

/// SDF buffer: padding pixels around the glyph bitmap for SDF generation.
const SDF_BUFFER: usize = 6;

/// SDF radius: max distance (in pixels) captured by the distance field.
const SDF_RADIUS: usize = 6;

/// Ensure all required glyphs (by glyph ID, post-shaping) are in the atlas.
///
/// For each glyph ID not yet in the atlas, rasterizes a bitmap with fontdue,
/// then generates an SDF using sdf_glyph_renderer (TinySDF/Felzenszwalb algorithm).
/// Updates LRU timestamps for all requested glyphs.
/// If the atlas is full, evicts the coldest unused glyphs before retrying.
pub fn ensure_glyphs_in_atlas(
    raster_font: &fontdue::Font,
    glyph_ids: &[u32],
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

        // Rasterize glyph to bitmap using fontdue
        let (metrics, bitmap) = raster_font.rasterize_indexed(glyph_id as u16, SDF_PX_SIZE);

        if metrics.width == 0 || metrics.height == 0 {
            continue;
        }

        // Generate SDF from bitmap using sdf_glyph_renderer (Felzenszwalb algorithm)
        let Ok(glyph_bitmap) =
            BitmapGlyph::from_unbuffered(&bitmap, metrics.width, metrics.height, SDF_BUFFER)
        else {
            continue;
        };

        let sdf_f64 = glyph_bitmap.render_sdf(SDF_RADIUS);

        // Convert f64 SDF to u8 [0, 255].
        // sdf_glyph_renderer convention: positive = outside, negative = inside.
        // clamp_to_u8 with cutoff=0.5 maps: inside → high values (>128), outside → low values (<128).
        let Ok(sdf_data) = clamp_to_u8(&sdf_f64, 0.5) else {
            continue;
        };

        // The SDF output includes the buffer on all sides
        let sdf_w = metrics.width + SDF_BUFFER * 2;
        let sdf_h = metrics.height + SDF_BUFFER * 2;

        let alloc_size = Size::new(sdf_w as i32, sdf_h as i32);

        // Try to allocate; if full, evict cold glyphs and retry
        let alloc = atlas.allocator.allocate(alloc_size).or_else(|| {
            evict_cold_glyphs(atlas, current_frame, LRU_MIN_AGE);
            atlas.allocator.allocate(alloc_size)
        });

        let Some(alloc) = alloc else {
            #[cfg(debug_assertions)]
            eprintln!("SDF atlas: failed to allocate space for glyph {glyph_id} after eviction");
            continue;
        };

        let rect = alloc.rectangle;
        let atlas_x = rect.min.x;
        let atlas_y = rect.min.y;

        // Copy SDF data into the atlas pixel buffer (R8 format), Y-flipped for OpenGL
        for y in 0..sdf_h {
            for x in 0..sdf_w {
                let src_idx = y * sdf_w + x;
                let dst_x = atlas_x as usize + x;
                let dst_y = atlas_y as usize + (sdf_h - 1 - y);
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
                atlas_w: sdf_w as u32,
                atlas_h: sdf_h as u32,
                // Adjust bearings to account for the SDF buffer
                bearing_x: metrics.xmin as f32 - SDF_BUFFER as f32,
                bearing_y: metrics.ymin as f32 - SDF_BUFFER as f32,
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
    let evictable: Vec<(u32, u64)> = atlas
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

    for (glyph_id, _) in evictable {
        if let Some(metrics) = atlas.glyph_map.remove(&glyph_id) {
            atlas.allocator.deallocate(metrics.alloc_id);
            atlas.last_used.remove(&glyph_id);
        }
    }
}
