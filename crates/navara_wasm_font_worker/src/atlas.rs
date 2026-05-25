use guillotiere::{AllocId, AtlasAllocator, Size};
use rustc_hash::FxHashMap;
use sdf_glyph_renderer::{BitmapGlyph, clamp_to_u8};

use crate::cache::LRU_MIN_AGE;
use crate::msdf::{Face, MSDF_CHANNELS, rasterize_msdf};
/// Default SDF atlas dimensions (width x height in pixels).
pub const DEFAULT_ATLAS_SIZE: i32 = 1024 * 2;

/// Hard cap on atlas growth. Each step doubles the side length, so 8192 means
/// we'll grow at most: 2048 → 4096 → 8192 (~64 MiB for the R8 pixel buffer).
pub const MAX_ATLAS_SIZE: i32 = 1024 * 8;

/// SDF buffer: padding pixels around the glyph bitmap for SDF generation.
const SDF_BUFFER: usize = 12;

/// SDF radius: max distance (in pixels) captured by the distance field.
const SDF_RADIUS: usize = 35;

/// Font size in pixels used for SDF rasterization.
/// A single SDF glyph at this size can render both small and large text.
pub const SDF_PX_SIZE: f32 = 64.0;

/// Atlas rasterization mode: pick the field flavor used for monochrome glyphs.
///
/// Single-channel SDF goes through `sdf_glyph_renderer` (Felzenszwalb on a
/// fontdue bitmap), MSDF goes through `fdsm` directly on the vector outline.
/// MSDF preserves sharp corners but the per-glyph cost is ~100× higher because
/// `fdsm` does exact distance-to-curve math with no spatial acceleration.
///
/// Selected at atlas creation time so a single FontCache can hold both flavors
/// side-by-side (one atlas per font + quality combination, see
/// [`SDFAtlas::mode`]). The TS layer surfaces this as a per-text-material
/// `quality: "low" | "high"` knob.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AtlasMode {
    Sdf,
    Msdf,
}

/// Extra atlas pixels reserved on every side of each glyph rect to keep the
/// bilinear sampler from reading neighboring glyphs' distance values.
/// Without this, glyph edges show flickering pixels at the rect boundary.
/// The padded ring is left zeroed (i.e. fully "outside" for either field
/// type), so sampling into it produces a clean fade to the surrounding
/// color, not a discontinuity.
const ATLAS_GLYPH_PADDING: i32 = 1;

/// Bytes per atlas pixel for the active mode.
pub const fn atlas_channels(mode: AtlasMode) -> usize {
    match mode {
        AtlasMode::Sdf => 1,
        AtlasMode::Msdf => MSDF_CHANNELS,
    }
}

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

/// SDF / MSDF texture atlas that can be shared by multiple fonts.
///
/// Glyphs are keyed by a composite `u64` of `(font_index, glyph_id)` so that
/// different fonts sharing the same atlas never collide on glyph IDs.
/// For standalone fonts (one atlas per URL) the font_index is the unique index
/// assigned by `FontCache` at load time.
///
/// The atlas stores either single-channel SDF (R8) or 4-channel MTSDF (RGBA8)
/// pixel data based on [`Self::mode`]. `pixel_data.len() == width * height * channels`.
pub struct SDFAtlas {
    /// Rasterization flavor for glyphs blitted into this atlas. Fixed at
    /// construction time — every glyph in the atlas must come from the same
    /// raster path so the shader can sample consistently.
    pub mode: AtlasMode,
    /// Rectangle packer for allocating glyph regions
    pub allocator: AtlasAllocator,
    /// Raw pixel data of the atlas texture, interleaved by [`Self::channels`].
    pub pixel_data: Vec<u8>,
    /// Atlas width in pixels
    pub width: u32,
    /// Atlas height in pixels
    pub height: u32,
    /// Bytes per pixel (1 for SDF, 4 for MSDF/MTSDF). Derived from [`Self::mode`].
    pub channels: u8,
    /// Map from composite key `(font_index << 32 | glyph_id)` to metrics
    pub glyph_map: FxHashMap<u64, GlyphMetrics>,
    /// LRU tracking: composite key → tick at which the glyph was last used.
    pub last_used: FxHashMap<u64, u64>,
}

/// Pack a font index and glyph ID into a single u64 key.
#[inline]
pub fn composite_key(font_index: u32, glyph_id: u32) -> u64 {
    (font_index as u64) << 32 | glyph_id as u64
}

/// Orientation of a glyph raster's row order relative to OpenGL Y-up.
enum GlyphOrientation {
    /// Row 0 is the top of the glyph (fontdue / sdf_glyph_renderer convention).
    YDown,
    /// Row 0 is the bottom of the glyph (fdsm / TTF convention).
    YUp,
}

/// One glyph rasterized into the active atlas pixel format.
/// Independent of which raster path produced it.
struct GlyphRaster {
    /// Interleaved pixel bytes, `width * height * channels` long.
    pixels: Vec<u8>,
    width: usize,
    height: usize,
    bearing_x: f32,
    bearing_y: f32,
    orientation: GlyphOrientation,
}

/// fontdue + `sdf_glyph_renderer` single-channel SDF path.
fn sdf_rasterize(raster_font: &fontdue::Font, glyph_id: u32) -> Option<GlyphRaster> {
    let (metrics, bitmap) = raster_font.rasterize_indexed(glyph_id as u16, SDF_PX_SIZE);
    if metrics.width == 0 || metrics.height == 0 {
        return None;
    }
    let glyph_bitmap =
        BitmapGlyph::from_unbuffered(&bitmap, metrics.width, metrics.height, SDF_BUFFER).ok()?;
    let sdf_f64 = glyph_bitmap.render_sdf(SDF_RADIUS);
    // sdf_glyph_renderer convention: positive = outside, negative = inside.
    // clamp_to_u8 with cutoff=0.5 maps: inside → high values (>128), outside → low values (<128).
    let sdf_data = clamp_to_u8(&sdf_f64, 0.5).ok()?;
    let w = metrics.width + SDF_BUFFER * 2;
    let h = metrics.height + SDF_BUFFER * 2;
    Some(GlyphRaster {
        pixels: sdf_data,
        width: w,
        height: h,
        // Bearings include the SDF buffer added by sdf_glyph_renderer.
        bearing_x: metrics.xmin as f32 - SDF_BUFFER as f32,
        bearing_y: metrics.ymin as f32 - SDF_BUFFER as f32,
        orientation: GlyphOrientation::YDown,
    })
}

/// ttf-parser + fdsm MSDF path.
///
/// `face` is parsed once by the caller and reused for every glyph in the
/// batch; parsing it per glyph is the dominant cost otherwise.
fn msdf_rasterize(face: &Face<'_>, glyph_id: u32) -> Option<GlyphRaster> {
    let g = rasterize_msdf(face, glyph_id as u16, SDF_PX_SIZE)?;
    Some(GlyphRaster {
        pixels: g.pixels,
        width: g.width as usize,
        height: g.height as usize,
        bearing_x: g.bearing_x,
        bearing_y: g.bearing_y,
        orientation: GlyphOrientation::YUp,
    })
}

impl SDFAtlas {
    pub fn new(size: i32, mode: AtlasMode) -> Self {
        let channels = atlas_channels(mode);
        Self {
            mode,
            allocator: AtlasAllocator::new(Size::new(size, size)),
            pixel_data: vec![0u8; (size * size) as usize * channels],
            width: size as u32,
            height: size as u32,
            channels: channels as u8,
            glyph_map: FxHashMap::default(),
            last_used: FxHashMap::default(),
        }
    }

    /// Mark a glyph as used at the given tick (for LRU tracking).
    pub fn touch(&mut self, key: u64, tick: u64) {
        self.last_used.insert(key, tick);
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
    /// Updates LRU timestamps for all requested glyphs. If the atlas is full,
    /// evicts the coldest unused glyphs before retrying.
    ///
    /// The actual raster path depends on [`ATLAS_MODE`]:
    /// - [`AtlasMode::Sdf`]: fontdue bitmap → `sdf_glyph_renderer` (Felzenszwalb).
    /// - [`AtlasMode::Msdf`]: ttf-parser outline → `fdsm` MSDF.
    pub fn ensure_glyphs_in_atlas(
        &mut self,
        raster_font: &fontdue::Font,
        font_data: &[u8],
        font_index: u32,
        glyph_ids: &[u32],
        tick: u64,
    ) -> bool {
        // Parse the ttf-parser Face once for the whole batch. Re-parsing per
        // glyph (cmap, kern, hmtx, ...) was previously the bulk of MSDF cost
        // when many unique glyphs were rasterized at once.
        let msdf_face = match self.mode {
            AtlasMode::Msdf => Face::parse(font_data, 0).ok(),
            AtlasMode::Sdf => None,
        };

        let mut new_glyphs = false;
        for &glyph_id in glyph_ids {
            let key = composite_key(font_index, glyph_id);

            // Always touch the glyph for LRU, even if already present
            self.touch(key, tick);

            if self.contains(key) {
                continue;
            }

            let Some(raster) = self.rasterize_glyph(raster_font, msdf_face.as_ref(), glyph_id)
            else {
                continue;
            };

            // Request padding on all sides so bilinear sampling at the
            // glyph's edge doesn't read neighboring glyphs' distance values.
            // The ring stays zeroed and reads as "deep outside" for both SDF
            // and MSDF/MTSDF, which is what the shader expects past the edge.
            let pad = ATLAS_GLYPH_PADDING;
            let alloc_size = Size::new(
                raster.width as i32 + 2 * pad,
                raster.height as i32 + 2 * pad,
            );

            // Try to allocate; if full, evict cold glyphs and retry; if still
            // full, grow the atlas (up to MAX_ATLAS_SIZE) and retry once more.
            let alloc = self
                .allocator
                .allocate(alloc_size)
                .or_else(|| {
                    self.evict_cold_glyphs(tick, LRU_MIN_AGE);
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
            // Inset by the padding ring; the metrics record the inner glyph
            // region, not the padded allocation.
            let atlas_x = rect.min.x + pad;
            let atlas_y = rect.min.y + pad;

            self.blit_glyph(&raster, atlas_x, atlas_y);

            self.glyph_map.insert(
                key,
                GlyphMetrics {
                    alloc_id: alloc.id,
                    atlas_x,
                    atlas_y,
                    atlas_w: raster.width as u32,
                    atlas_h: raster.height as u32,
                    bearing_x: raster.bearing_x,
                    bearing_y: raster.bearing_y,
                },
            );
            new_glyphs = true;
        }
        new_glyphs
    }

    /// Produce a single glyph's pixel data for this atlas's [`Self::mode`].
    /// Returns `None` for empty glyphs or outline-loading failures.
    ///
    /// `face` must be `Some` in [`AtlasMode::Msdf`] and is unused in
    /// [`AtlasMode::Sdf`]; the caller parses it once per batch.
    fn rasterize_glyph(
        &self,
        raster_font: &fontdue::Font,
        face: Option<&Face<'_>>,
        glyph_id: u32,
    ) -> Option<GlyphRaster> {
        match self.mode {
            AtlasMode::Sdf => sdf_rasterize(raster_font, glyph_id),
            AtlasMode::Msdf => msdf_rasterize(face?, glyph_id),
        }
    }

    /// Copy a rasterized glyph into the atlas at `(atlas_x, atlas_y)`.
    ///
    /// For SDF (Y-down source), rows are Y-flipped on copy so the atlas ends
    /// up in OpenGL convention. MSDF output is already Y-up — no flip needed.
    fn blit_glyph(&mut self, raster: &GlyphRaster, atlas_x: i32, atlas_y: i32) {
        let ch = self.channels as usize;
        let atlas_w = self.width as usize;
        let gw = raster.width;
        let gh = raster.height;
        for y in 0..gh {
            for x in 0..gw {
                let src_idx = (y * gw + x) * ch;
                let dst_y = match raster.orientation {
                    GlyphOrientation::YDown => atlas_y as usize + (gh - 1 - y),
                    GlyphOrientation::YUp => atlas_y as usize + y,
                };
                let dst_x = atlas_x as usize + x;
                let dst_idx = (dst_y * atlas_w + dst_x) * ch;

                if src_idx + ch > raster.pixels.len() || dst_idx + ch > self.pixel_data.len() {
                    continue;
                }
                self.pixel_data[dst_idx..dst_idx + ch]
                    .copy_from_slice(&raster.pixels[src_idx..src_idx + ch]);
            }
        }
    }

    /// Double the atlas dimensions (square) up to `MAX_ATLAS_SIZE`. Existing
    /// glyph allocations keep their `(atlas_x, atlas_y, atlas_w, atlas_h)`
    /// metrics — guillotiere's `grow` preserves them, and the existing pixel
    /// data is copied row-by-row into the new wider buffer at the same coords.
    ///
    /// Returns `true` if the atlas was grown, `false` if the cap has already
    /// been reached.
    pub fn grow(&mut self) -> bool {
        let new_w = (self.width as i32).saturating_mul(2).min(MAX_ATLAS_SIZE);
        let new_h = (self.height as i32).saturating_mul(2).min(MAX_ATLAS_SIZE);
        if new_w == self.width as i32 && new_h == self.height as i32 {
            return false;
        }

        let old_w = self.width as usize;
        let old_h = self.height as usize;
        let new_w_usize = new_w as usize;
        let new_h_usize = new_h as usize;
        let ch = self.channels as usize;

        // Repack pixel data into a wider/taller row-major buffer at the same
        // (x, y) coordinates so existing glyph_map entries remain valid.
        let mut new_pixels = vec![0u8; new_w_usize * new_h_usize * ch];
        for y in 0..old_h {
            let src = y * old_w * ch;
            let dst = y * new_w_usize * ch;
            let row_bytes = old_w * ch;
            new_pixels[dst..dst + row_bytes]
                .copy_from_slice(&self.pixel_data[src..src + row_bytes]);
        }

        self.allocator.grow(Size::new(new_w, new_h));
        self.pixel_data = new_pixels;
        self.width = new_w as u32;
        self.height = new_h as u32;
        true
    }

    /// Evict glyphs that haven't been used for at least `min_age` ticks.
    ///
    /// A tick is one `prepareTextBatch` call (see [`LRU_MIN_AGE`]), so a glyph
    /// is evictable once 5 batches have completed without touching it.
    /// Frees atlas space by deallocating the coldest glyphs first.
    fn evict_cold_glyphs(&mut self, tick: u64, min_age: u64) {
        let evictable: Vec<(u64, u64)> = self
            .last_used
            .iter()
            .filter_map(|(&key, &last_tick)| {
                if tick.saturating_sub(last_tick) >= min_age {
                    Some((key, last_tick))
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
