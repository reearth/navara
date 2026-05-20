use guillotiere::{AllocId, AtlasAllocator, Size};
use rustc_hash::FxHashMap;
use sdf_glyph_renderer::{BitmapGlyph, clamp_to_u8};

use crate::cache::LRU_MIN_AGE;
use wasm_bindgen::prelude::*;
#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}



/// Default SDF atlas dimensions (width x height in pixels).
pub const DEFAULT_ATLAS_SIZE: i32 = 1024 * 2;

/// Hard cap on atlas growth. Each step doubles the side length, so 8192 means
/// we'll grow at most: 2048 → 4096 → 8192 (256 MB for the R8 pixel buffer).
pub const MAX_ATLAS_SIZE: i32 = 1024 * 8;

/// SDF buffer: padding pixels around the glyph bitmap for SDF generation.
const SDF_BUFFER: usize = 12;

/// SDF radius: max distance (in pixels) captured by the distance field.
const SDF_RADIUS: usize = 35;

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

/// SDF texture atlas that can be shared by multiple fonts.
///
/// Glyphs are keyed by a composite `u64` of `(font_index, glyph_id)` so that
/// different fonts sharing the same atlas never collide on glyph IDs.
/// For standalone fonts (one atlas per URL) the font_index is the unique index
/// assigned by `FontCache` at load time.
pub struct SDFAtlas {
    /// Rectangle packer for allocating glyph regions
    pub allocator: AtlasAllocator,
    /// Raw single-channel SDF pixel data of the atlas texture
    pub pixel_data: Vec<u8>,
    /// Atlas width in pixels
    pub width: u32,
    /// Atlas height in pixels
    pub height: u32,
    /// Map from composite key `(font_index << 32 | glyph_id)` to metrics
    pub glyph_map: FxHashMap<u64, GlyphMetrics>,
    /// LRU tracking: composite key → last frame the glyph was used
    pub last_used: FxHashMap<u64, u64>,
}

/// Pack a font index and glyph ID into a single u64 key.
#[inline]
pub fn composite_key(font_index: u32, glyph_id: u32) -> u64 {
    (font_index as u64) << 32 | glyph_id as u64
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
    pub fn touch(&mut self, key: u64, current_frame: u64) {
        self.last_used.insert(key, current_frame);
    }

    /// Check if a glyph is already in the atlas.
    pub fn contains(&self, key: u64) -> bool {
        self.glyph_map.contains_key(&key)
    }

    /// Get metrics for a glyph by its composite key.
    pub fn get_metrics(&self, key: u64) -> Option<&GlyphMetrics> {
        self.glyph_map.get(&key)
    }

    /// Remove a glyph from the atlas, freeing its allocated space.
    pub fn remove(&mut self, key: u64) {
        if let Some(metrics) = self.glyph_map.remove(&key) {
            self.allocator.deallocate(metrics.alloc_id);
            self.last_used.remove(&key);
        }
    }

    /// Ensure all required glyphs are in the atlas.
    ///
    /// `font_index` distinguishes glyphs from different fonts sharing the same atlas.
    /// For each glyph ID not yet in the atlas, rasterizes a bitmap with fontdue,
    /// then generates an SDF using sdf_glyph_renderer (TinySDF/Felzenszwalb algorithm).
    /// Updates LRU timestamps for all requested glyphs.
    /// If the atlas is full, evicts the coldest unused glyphs before retrying.
    pub fn ensure_glyphs_in_atlas(
        &mut self,
        raster_font: &fontdue::Font,
        font_index: u32,
        glyph_ids: &[u32],
        current_frame: u64,
    ) -> bool {
        let mut new_glyphs = false;
        for &glyph_id in glyph_ids {
            let key = composite_key(font_index, glyph_id);

            // Always touch the glyph for LRU, even if already present
            self.touch(key, current_frame);

            if self.contains(key) {
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

            // Try to allocate; if full, evict cold glyphs and retry; if still
            // full, grow the atlas (up to MAX_ATLAS_SIZE) and retry once more.
            let alloc = self
                .allocator
                .allocate(alloc_size)
                .or_else(|| {
                    self.evict_cold_glyphs(current_frame, LRU_MIN_AGE);
                    self.allocator.allocate(alloc_size)
                })
                .or_else(|| {
                    if self.grow() {
                        new_glyphs = true;
                        self.allocator.allocate(alloc_size)
                    } else {
                        None
                    }
                });

            let Some(alloc) = alloc else {
                #[cfg(debug_assertions)]
                eprintln!(
                    "SDF atlas: failed to allocate space for glyph {glyph_id} (font {font_index}) after eviction and grow"
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
                key,
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

    /// Double the atlas dimensions (square) up to `MAX_ATLAS_SIZE`. Existing
    /// glyph allocations keep their `(atlas_x, atlas_y, atlas_w, atlas_h)`
    /// metrics — guillotiere's `grow` preserves them, and the existing pixel
    /// data is copied row-by-row into the new wider buffer at the same coords.
    ///
    /// Returns `true` if the atlas was grown, `false` if the cap has already
    /// been reached.
    pub fn grow(&mut self) -> bool {
        log(&format!("SDF atlas: growing from {}x{} to {}x{}", self.width, self.height, self.width * 2, self.height * 2));
        let new_w = (self.width as i32).saturating_mul(2).min(MAX_ATLAS_SIZE);
        let new_h = (self.height as i32).saturating_mul(2).min(MAX_ATLAS_SIZE);
        if new_w == self.width as i32 && new_h == self.height as i32 {
            return false;
        }

        let old_w = self.width as usize;
        let old_h = self.height as usize;
        let new_w_usize = new_w as usize;
        let new_h_usize = new_h as usize;

        // Repack pixel data into a wider/taller row-major buffer at the same
        // (x, y) coordinates so existing glyph_map entries remain valid.
        let mut new_pixels = vec![0u8; new_w_usize * new_h_usize];
        for y in 0..old_h {
            let src = y * old_w;
            let dst = y * new_w_usize;
            new_pixels[dst..dst + old_w].copy_from_slice(&self.pixel_data[src..src + old_w]);
        }

        self.allocator.grow(Size::new(new_w, new_h));
        self.pixel_data = new_pixels;
        self.width = new_w as u32;
        self.height = new_h as u32;
        true
    }

    /// Evict glyphs that haven't been used for at least `min_age` frames.
    ///
    /// Frees atlas space by deallocating the coldest glyphs first.
    fn evict_cold_glyphs(&mut self, current_frame: u64, min_age: u64) {
        let evictable: Vec<(u64, u64)> = self
            .last_used
            .iter()
            .filter_map(|(&key, &last_frame)| {
                if current_frame.saturating_sub(last_frame) >= min_age {
                    Some((key, last_frame))
                } else {
                    None
                }
            })
            .collect();

        for (key, _) in evictable {
            self.remove(key);
        }
    }
}

impl Default for SDFAtlas {
    fn default() -> Self {
        Self::new(DEFAULT_ATLAS_SIZE)
    }
}
