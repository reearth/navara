use guillotiere::{AllocId, AtlasAllocator, Size};
use rustc_hash::FxHashMap;
use sdf_glyph_renderer::{BitmapGlyph, clamp_to_u8};

use crate::cache::LRU_MIN_AGE;
use crate::color_raster::{COLOR_GLYPH_PX_SIZE, rasterize_color_glyph};
use crate::msdf::{Face, MSDF_CHANNELS, rasterize_msdf};

/// Default SDF/MSDF atlas dimensions (width x height in pixels).
pub const DEFAULT_ATLAS_SIZE: i32 = 1024 * 2;

/// Default color atlas dimensions. 1024² × RGBA = 4 MB; LRU evicts when full.
pub const DEFAULT_COLOR_ATLAS_SIZE: i32 = 1024;

/// Hard cap on atlas growth. Each step doubles the side, so 8192 means at most
/// 2048 → 4096 → 8192 (~64 MiB for the R8 buffer).
pub const MAX_ATLAS_SIZE: i32 = 1024 * 8;

/// Padding pixels around a glyph bitmap during SDF generation.
const SDF_BUFFER: usize = 12;

/// Max distance (in pixels) captured by the single-channel SDF.
const SDF_RADIUS: usize = 35;

/// Font size used for SDF/MSDF rasterization.
pub const SDF_PX_SIZE: f32 = 64.0;

/// Atlas pixel format. Picked at atlas creation; every glyph in the atlas
/// must use the same path so the shader can sample consistently.
///
/// - `Sdf`: single-channel R8 (fontdue + Felzenszwalb).
/// - `Msdf`: 4-channel MTSDF (fdsm on the vector outline). ~100× per-glyph
///   cost vs SDF but sharper corners.
/// - `Color`: 4-channel RGBA (COLRv1 painter), selected automatically when
///   the font has a COLRv1 paint graph.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AtlasMode {
    Sdf,
    Msdf,
    Color,
}

impl AtlasMode {
    /// Bytes per atlas pixel for this mode.
    pub const fn channels(self) -> usize {
        match self {
            AtlasMode::Sdf => 1,
            AtlasMode::Msdf => MSDF_CHANNELS,
            AtlasMode::Color => 4,
        }
    }

    /// One zeroed pixel of padding around each glyph rect keeps bilinear
    /// sampling from reading neighboring glyphs. Color glyphs already include
    /// an internal antialiased ring from the rasterizer.
    const fn padding(self) -> i32 {
        match self {
            AtlasMode::Sdf | AtlasMode::Msdf => 1,
            AtlasMode::Color => 0,
        }
    }
}

/// Metrics for a single glyph in the atlas.
#[derive(Debug, Clone)]
pub struct GlyphMetrics {
    /// Allocator handle, used to free the rect on LRU eviction.
    pub alloc_id: AllocId,
    pub atlas_x: i32,
    pub atlas_y: i32,
    pub atlas_w: u32,
    pub atlas_h: u32,
    /// Horizontal offset from cursor to glyph left edge (pixels).
    pub bearing_x: f32,
    /// Vertical offset from baseline to glyph bottom edge (pixels).
    pub bearing_y: f32,
}

/// Glyph texture atlas shared by one or more fonts.
///
/// Glyphs are keyed by a composite `(font_index, glyph_id)` so fonts in the
/// same atlas never collide on glyph IDs. `pixel_data` is `width * height *
/// channels` bytes, with format determined by [`Self::mode`].
pub struct Atlas {
    pub mode: AtlasMode,
    pub allocator: AtlasAllocator,
    pub pixel_data: Vec<u8>,
    pub width: u32,
    pub height: u32,
    pub channels: u8,
    pub glyph_map: FxHashMap<u64, GlyphMetrics>,
    /// LRU tracking: composite key → tick at which the glyph was last used.
    pub last_used: FxHashMap<u64, u64>,
}

/// Pack a font index and glyph ID into a single u64 key.
#[inline]
pub fn composite_key(font_index: u32, glyph_id: u32) -> u64 {
    (font_index as u64) << 32 | glyph_id as u64
}

/// Row 0 of the raster: top (`YDown` — fontdue/tiny-skia) or bottom
/// (`YUp` — fdsm/TTF). `blit_glyph` Y-flips `YDown` rasters into the atlas.
enum GlyphOrientation {
    YDown,
    YUp,
}

/// One rasterized glyph in the active atlas pixel format.
struct GlyphRaster {
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
    // clamp_to_u8 cutoff=0.5 maps inside → >128, outside → <128.
    let sdf_data = clamp_to_u8(&glyph_bitmap.render_sdf(SDF_RADIUS), 0.5).ok()?;
    Some(GlyphRaster {
        pixels: sdf_data,
        width: metrics.width + SDF_BUFFER * 2,
        height: metrics.height + SDF_BUFFER * 2,
        // Bearings include the SDF buffer added by sdf_glyph_renderer.
        bearing_x: metrics.xmin as f32 - SDF_BUFFER as f32,
        bearing_y: metrics.ymin as f32 - SDF_BUFFER as f32,
        orientation: GlyphOrientation::YDown,
    })
}

/// ttf-parser + fdsm MSDF path. `face` is parsed once per batch by the caller.
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

/// skrifa + tiny-skia COLRv1 color path. tiny-skia is top-down so the blit
/// Y-flips it into the atlas's bottom-up convention.
fn color_rasterize(font_data: &[u8], glyph_id: u32) -> Option<GlyphRaster> {
    let bmp = rasterize_color_glyph(font_data, glyph_id, COLOR_GLYPH_PX_SIZE)?;
    Some(GlyphRaster {
        pixels: bmp.rgba,
        width: bmp.width as usize,
        height: bmp.height as usize,
        bearing_x: bmp.bearing_x,
        bearing_y: bmp.bearing_y,
        orientation: GlyphOrientation::YDown,
    })
}

impl Atlas {
    pub fn new(size: i32, mode: AtlasMode) -> Self {
        let channels = mode.channels();
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

    pub fn touch(&mut self, key: u64, tick: u64) {
        self.last_used.insert(key, tick);
    }

    pub fn contains(&self, key: u64) -> bool {
        self.glyph_map.contains_key(&key)
    }

    pub fn get_metrics(&self, key: u64) -> Option<&GlyphMetrics> {
        self.glyph_map.get(&key)
    }

    /// Remove a glyph and free its atlas rect.
    pub fn remove(&mut self, key: u64) {
        if let Some(metrics) = self.glyph_map.remove(&key) {
            self.allocator.deallocate(metrics.alloc_id);
            self.last_used.remove(&key);
        }
    }

    /// Rasterize and pack any requested glyphs that aren't already in the
    /// atlas. Returns `true` if the atlas pixels or dimensions changed.
    ///
    /// `font_index` distinguishes glyphs from different fonts sharing this
    /// atlas. LRU is touched for every requested glyph (present or not).
    /// On allocator failure: evict cold glyphs and retry, then grow and retry
    /// (capped at [`MAX_ATLAS_SIZE`]).
    ///
    /// `raster_font` is only consulted for [`AtlasMode::Sdf`]; MSDF and Color
    /// work from `font_data`.
    pub fn ensure_glyphs_in_atlas(
        &mut self,
        raster_font: &fontdue::Font,
        font_data: &[u8],
        font_index: u32,
        glyph_ids: &[u32],
        tick: u64,
    ) -> bool {
        // Parse Face once per batch — per-glyph parsing dominated MSDF cost.
        let msdf_face = match self.mode {
            AtlasMode::Msdf => Face::parse(font_data, 0).ok(),
            AtlasMode::Sdf | AtlasMode::Color => None,
        };

        let pad = self.mode.padding();
        let mut new_glyphs = false;
        for &glyph_id in glyph_ids {
            let key = composite_key(font_index, glyph_id);
            self.touch(key, tick);

            if self.contains(key) {
                continue;
            }

            let Some(raster) =
                self.rasterize_glyph(raster_font, font_data, msdf_face.as_ref(), glyph_id)
            else {
                continue;
            };

            // Pad the request so bilinear sampling at glyph edges can't pick
            // up neighbors. The zeroed ring reads as "deep outside" for SDF
            // and MTSDF.
            let alloc_size = Size::new(
                raster.width as i32 + 2 * pad,
                raster.height as i32 + 2 * pad,
            );

            let alloc = self
                .allocator
                .allocate(alloc_size)
                .or_else(|| {
                    self.evict_cold_glyphs(tick, LRU_MIN_AGE);
                    self.allocator.allocate(alloc_size)
                })
                .or_else(|| {
                    if self.grow() {
                        // Atlas dims changed — TS must re-upload even if the
                        // post-grow allocation still fails.
                        new_glyphs = true;
                        self.allocator.allocate(alloc_size)
                    } else {
                        None
                    }
                });

            let Some(alloc) = alloc else {
                #[cfg(debug_assertions)]
                eprintln!(
                    "Atlas: failed to allocate space for glyph {glyph_id} (font {font_index}) after eviction and grow"
                );
                continue;
            };

            // Inset by the padding ring; metrics record the inner rect.
            let atlas_x = alloc.rectangle.min.x + pad;
            let atlas_y = alloc.rectangle.min.y + pad;

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

    /// Rasterize a single glyph for the current mode. `face` must be `Some`
    /// for [`AtlasMode::Msdf`]; the caller parses it once per batch.
    fn rasterize_glyph(
        &self,
        raster_font: &fontdue::Font,
        font_data: &[u8],
        face: Option<&Face<'_>>,
        glyph_id: u32,
    ) -> Option<GlyphRaster> {
        match self.mode {
            AtlasMode::Sdf => sdf_rasterize(raster_font, glyph_id),
            AtlasMode::Msdf => msdf_rasterize(face?, glyph_id),
            AtlasMode::Color => color_rasterize(font_data, glyph_id),
        }
    }

    /// Copy a rasterized glyph into the atlas at `(atlas_x, atlas_y)`,
    /// Y-flipping `YDown` sources so the atlas ends up in OpenGL Y-up order.
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

    /// Double the atlas (square) up to [`MAX_ATLAS_SIZE`]. Existing glyph
    /// metrics stay valid: guillotiere preserves allocations and the pixel
    /// buffer is recopied at the same `(x, y)`. Returns `false` if capped.
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
        let row_bytes = old_w * ch;

        let mut new_pixels = vec![0u8; new_w_usize * new_h_usize * ch];
        for y in 0..old_h {
            let src = y * old_w * ch;
            let dst = y * new_w_usize * ch;
            new_pixels[dst..dst + row_bytes]
                .copy_from_slice(&self.pixel_data[src..src + row_bytes]);
        }

        self.allocator.grow(Size::new(new_w, new_h));
        self.pixel_data = new_pixels;
        self.width = new_w as u32;
        self.height = new_h as u32;
        true
    }

    /// Evict glyphs untouched for at least `min_age` ticks (one tick per
    /// `prepareTextBatch`; see [`LRU_MIN_AGE`]).
    fn evict_cold_glyphs(&mut self, tick: u64, min_age: u64) {
        let evictable: Vec<u64> = self
            .last_used
            .iter()
            .filter_map(|(&key, &last_tick)| {
                (tick.saturating_sub(last_tick) >= min_age).then_some(key)
            })
            .collect();

        for key in evictable {
            self.remove(key);
        }
    }
}
