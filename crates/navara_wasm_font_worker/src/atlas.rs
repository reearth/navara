use guillotiere::{AllocId, AtlasAllocator, Size};
use rustc_hash::FxHashMap;
use sdf_glyph_renderer::{BitmapGlyph, clamp_to_u8};

use crate::cache::LRU_MIN_AGE;

/// Default SDF atlas dimensions (width x height in pixels).
pub const DEFAULT_ATLAS_SIZE: i32 = 1024 * 2;

/// SDF buffer: padding pixels around the glyph bitmap for SDF generation.
const SDF_BUFFER: usize = 6;

/// SDF radius: max distance (in pixels) captured by the distance field.
const SDF_RADIUS: usize = 6;

/// Font size in pixels used for SDF rasterization.
/// A single SDF glyph at this size can render both small and large text.
pub const SDF_PX_SIZE: f32 = 64.0;

/// Metrics for a single glyph in the SDF atlas.
#[derive(Debug, Clone)]
pub struct GlyphMetrics {
    /// Allocation ID in the atlas (for deallocation during LRU eviction)
    pub alloc_id: AllocId,
    /// X position of the glyph in the atlas (pixels)
    pub atlas_x: i32,
    /// Y position of the glyph in the atlas (pixels)
    pub atlas_y: i32,
    /// Width of the glyph region in the atlas (pixels)
    pub atlas_w: u32,
    /// Height of the glyph region in the atlas (pixels)
    pub atlas_h: u32,
    /// Horizontal bearing (offset from cursor to glyph left edge)
    pub bearing_x: f32,
    /// Vertical bearing (offset from baseline to glyph bottom edge)
    pub bearing_y: f32,
}

/// Per-font SDF texture atlas.
///
/// Each loaded font gets its own atlas. Glyphs are keyed by glyph ID
/// (post-shaping, not Unicode codepoint) so that contextual forms
/// (Arabic positional variants, ligatures, etc.) are stored correctly.
pub struct SDFAtlas {
    /// Rectangle packer for allocating glyph regions
    pub allocator: AtlasAllocator,
    /// Raw single-channel SDF pixel data of the atlas texture
    pub pixel_data: Vec<u8>,
    /// Atlas width in pixels
    pub width: u32,
    /// Atlas height in pixels
    pub height: u32,
    /// Map from glyph ID (post-shaping) to its metrics/position in the atlas
    pub glyph_map: FxHashMap<u32, GlyphMetrics>,
    /// LRU tracking: glyph ID → last frame the glyph was used
    pub last_used: FxHashMap<u32, u64>,
}

impl SDFAtlas {
    pub fn new(size: i32) -> Self {
        Self {
            allocator: AtlasAllocator::new(Size::new(size, size)),
            pixel_data: vec![0u8; (size * size) as usize],
            width: size as u32,
            height: size as u32,
            glyph_map: FxHashMap::default(),
            last_used: FxHashMap::default(),
        }
    }

    /// Mark a glyph as used this frame (for LRU tracking).
    pub fn touch(&mut self, glyph_id: u32, current_frame: u64) {
        self.last_used.insert(glyph_id, current_frame);
    }

    /// Check if a glyph is already in the atlas.
    pub fn contains(&self, glyph_id: u32) -> bool {
        self.glyph_map.contains_key(&glyph_id)
    }

    /// Remove a glyph from the atlas, freeing its allocated space.
    pub fn remove(&mut self, glyph_id: u32) {
        if let Some(metrics) = self.glyph_map.remove(&glyph_id) {
            self.allocator.deallocate(metrics.alloc_id);
            self.last_used.remove(&glyph_id);
        }
    }

    /// Ensure all required glyphs (by glyph ID, post-shaping) are in the atlas.
    ///
    /// For each glyph ID not yet in the atlas, rasterizes a bitmap with fontdue,
    /// then generates an SDF using sdf_glyph_renderer (TinySDF/Felzenszwalb algorithm).
    /// Updates LRU timestamps for all requested glyphs.
    /// If the atlas is full, evicts the coldest unused glyphs before retrying.
    pub fn ensure_glyphs_in_atlas(
        &mut self,
        raster_font: &fontdue::Font,
        glyph_ids: &[u32],
        current_frame: u64,
    ) -> bool {
        let mut new_glyphs = false;
        for &glyph_id in glyph_ids {
            // Always touch the glyph for LRU, even if already present
            self.touch(glyph_id, current_frame);

            if self.contains(glyph_id) {
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
            let alloc = self.allocator.allocate(alloc_size).or_else(|| {
                self.evict_cold_glyphs(current_frame, LRU_MIN_AGE);
                self.allocator.allocate(alloc_size)
            });

            let Some(alloc) = alloc else {
                #[cfg(debug_assertions)]
                eprintln!(
                    "SDF atlas: failed to allocate space for glyph {glyph_id} after eviction"
                );
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
                    let dst_idx = dst_y * self.width as usize + dst_x;

                    if src_idx < sdf_data.len() && dst_idx < self.pixel_data.len() {
                        self.pixel_data[dst_idx] = sdf_data[src_idx];
                    }
                }
            }

            self.glyph_map.insert(
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
    fn evict_cold_glyphs(&mut self, current_frame: u64, min_age: u64) {
        let evictable: Vec<(u32, u64)> = self
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
            self.remove(glyph_id);
        }
    }
}

impl Default for SDFAtlas {
    fn default() -> Self {
        Self::new(DEFAULT_ATLAS_SIZE)
    }
}
