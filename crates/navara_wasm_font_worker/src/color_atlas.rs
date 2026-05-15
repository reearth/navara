//! RGBA color glyph atlas.
//!
//! Mirrors [`crate::atlas::SDFAtlas`] but stores RGBA8 pixels for COLRv1 glyphs
//! rasterized via [`crate::color_raster::rasterize_color_glyph`]. Color glyphs
//! and SDF glyphs live in separate atlases so the SDF path stays single-channel
//! and the GPU can pick the right sampler/format per atlas.

use guillotiere::{AtlasAllocator, Size};
use rustc_hash::FxHashMap;

use crate::atlas::{GlyphMetrics, composite_key};
use crate::cache::LRU_MIN_AGE;
use crate::color_raster::{COLOR_GLYPH_PX_SIZE, rasterize_color_glyph};

/// Default color atlas dimensions (pixels per side).
///
/// 1024² × 4 bytes = 4 MB — fits ~50 color glyphs at 128px, enough for typical
/// emoji ranges in view. LRU evicts cold glyphs when the atlas fills.
pub const DEFAULT_COLOR_ATLAS_SIZE: i32 = 1024;

/// RGBA8 color glyph atlas.
pub struct ColorAtlas {
    pub allocator: AtlasAllocator,
    /// Raw RGBA8 pixel data, row-major, top-down.
    pub pixel_data: Vec<u8>,
    pub width: u32,
    pub height: u32,
    /// Map from composite key `(font_index << 32 | glyph_id)` to metrics.
    pub glyph_map: FxHashMap<u64, GlyphMetrics>,
    /// LRU tracking: composite key → last frame the glyph was used.
    pub last_used: FxHashMap<u64, u64>,
}

impl ColorAtlas {
    pub fn new(size: i32) -> Self {
        let pixels = (size as usize) * (size as usize) * 4;
        Self {
            allocator: AtlasAllocator::new(Size::new(size, size)),
            pixel_data: vec![0u8; pixels],
            width: size as u32,
            height: size as u32,
            glyph_map: FxHashMap::default(),
            last_used: FxHashMap::default(),
        }
    }

    pub fn touch(&mut self, key: u64, current_frame: u64) {
        self.last_used.insert(key, current_frame);
    }

    pub fn contains(&self, key: u64) -> bool {
        self.glyph_map.contains_key(&key)
    }

    pub fn get_metrics(&self, key: u64) -> Option<&GlyphMetrics> {
        self.glyph_map.get(&key)
    }

    pub fn remove(&mut self, key: u64) {
        if let Some(metrics) = self.glyph_map.remove(&key) {
            self.allocator.deallocate(metrics.alloc_id);
            self.last_used.remove(&key);
        }
    }

    /// Ensure all requested glyphs are rasterized into the color atlas.
    ///
    /// Returns `true` if any new glyphs were added (caller should re-upload the
    /// texture). `font_data` is the raw OpenType byte slice belonging to the
    /// font identified by `font_index`.
    pub fn ensure_glyphs_in_atlas(
        &mut self,
        font_data: &[u8],
        font_index: u32,
        glyph_ids: &[u32],
        current_frame: u64,
    ) -> bool {
        let mut new_glyphs = false;
        for &glyph_id in glyph_ids {
            let key = composite_key(font_index, glyph_id);
            self.touch(key, current_frame);
            if self.contains(key) {
                continue;
            }

            let Some(bitmap) = rasterize_color_glyph(font_data, glyph_id, COLOR_GLYPH_PX_SIZE)
            else {
                continue;
            };

            let alloc_size = Size::new(bitmap.width as i32, bitmap.height as i32);
            let alloc = self.allocator.allocate(alloc_size).or_else(|| {
                self.evict_cold_glyphs(current_frame, LRU_MIN_AGE);
                self.allocator.allocate(alloc_size)
            });

            let Some(alloc) = alloc else {
                #[cfg(debug_assertions)]
                eprintln!(
                    "Color atlas: failed to allocate space for glyph {glyph_id} (font {font_index}) after eviction"
                );
                continue;
            };

            let rect = alloc.rectangle;
            let atlas_x = rect.min.x;
            let atlas_y = rect.min.y;

            // Copy RGBA pixels into the atlas buffer, Y-flipped so the atlas
            // shares the bottom-up layout used by the SDF atlas (UV origin at
            // bottom-left, matching the OpenGL convention the shader assumes).
            let aw = self.width as usize;
            let bw = bitmap.width as usize;
            let bh = bitmap.height as usize;
            let row_bytes = bw * 4;
            for y in 0..bh {
                let src_row = y * row_bytes;
                let dst_y = atlas_y as usize + (bh - 1 - y);
                let dst_row = (dst_y * aw + atlas_x as usize) * 4;
                let src_end = src_row + row_bytes;
                let dst_end = dst_row + row_bytes;
                if src_end <= bitmap.rgba.len() && dst_end <= self.pixel_data.len() {
                    self.pixel_data[dst_row..dst_end]
                        .copy_from_slice(&bitmap.rgba[src_row..src_end]);
                }
            }

            self.glyph_map.insert(
                key,
                GlyphMetrics {
                    alloc_id: alloc.id,
                    atlas_x,
                    atlas_y,
                    atlas_w: bitmap.width,
                    atlas_h: bitmap.height,
                    bearing_x: bitmap.bearing_x,
                    bearing_y: bitmap.bearing_y,
                },
            );
            new_glyphs = true;
        }
        new_glyphs
    }

    fn evict_cold_glyphs(&mut self, current_frame: u64, min_age: u64) {
        let evictable: Vec<u64> = self
            .last_used
            .iter()
            .filter_map(|(&key, &last_frame)| {
                (current_frame.saturating_sub(last_frame) >= min_age).then_some(key)
            })
            .collect();
        for key in evictable {
            self.remove(key);
        }
    }
}

impl Default for ColorAtlas {
    fn default() -> Self {
        Self::new(DEFAULT_COLOR_ATLAS_SIZE)
    }
}
