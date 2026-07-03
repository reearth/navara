use guillotiere::{AllocId, AtlasAllocator, Size};
use rustc_hash::{FxHashMap, FxHashSet};
use sdf_glyph_renderer::{BitmapGlyph, clamp_to_u8};

use crate::color_raster::{COLOR_GLYPH_PX_SIZE, rasterize_color_glyph};
use crate::msdf::{Face, MSDF_CHANNELS, rasterize_msdf};

/// Default SDF/MSDF atlas dimensions (width x height in pixels).
pub const DEFAULT_ATLAS_SIZE: i32 = 1024 * 2;

/// Default color atlas dimensions. 1024² × RGBA = 4 MB; LRU evicts when full.
pub const DEFAULT_COLOR_ATLAS_SIZE: i32 = 1024;

/// Hard cap on atlas growth. Each step doubles the side, so 8192 means at most
/// 2048 → 4096 → 8192 (~64 MiB for the R8 buffer).
pub const MAX_ATLAS_SIZE: i32 = 1024 * 8;

/// How many recent `ensure_glyphs_in_atlas` calls a freshly-packed glyph stays
/// protected from eviction while waiting for the client to retain it.
///
/// A glyph has no reference count between the moment it is packed and the moment
/// the TS mesh (built from the shaped result a few messages later) calls
/// `retainGlyphs`. Without this grace, a *subsequent* batch needing space could
/// evict the glyph and reuse its rect, leaving the in-flight mesh sampling the
/// wrong glyph. Protecting the last `EVICTION_GRACE_CALLS` calls' additions
/// covers that retain lag; glyphs older than the window that are still
/// unreferenced (shaped but never displayed) age out and become evictable, so
/// the protection set stays bounded. Under sustained pressure this degrades to a
/// *missing* glyph (allocation fails, glyph skipped), never a *wrong* one.
pub const EVICTION_GRACE_CALLS: u64 = 512;

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
    /// Reference counts keyed by composite key: how many *visible* labels
    /// currently use the glyph. Driven by TypeScript — incremented when a label
    /// showing the glyph becomes visible, decremented when it hides or is
    /// disposed. A glyph with no entry here (count 0) is unreferenced and may be
    /// evicted to reclaim space; a glyph with `>= 1` is on screen and must never
    /// be evicted, since its atlas rect is baked into a live mesh.
    pub ref_count: FxHashMap<u64, u32>,
    /// Monotonic counter, bumped once per [`Self::ensure_glyphs_in_atlas`] call,
    /// used to age entries in `pending`.
    pack_seq: u64,
    /// Freshly-packed, not-yet-retained glyphs → the `pack_seq` at which they
    /// were added. Such a glyph is protected from eviction until the client
    /// retains it or it ages past [`EVICTION_GRACE_CALLS`] (see that constant for
    /// the race this closes). A glyph leaves here when retained (moves into
    /// `ref_count`) or when removed/evicted.
    pending: FxHashMap<u64, u64>,
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
            ref_count: FxHashMap::default(),
            pack_seq: 0,
            pending: FxHashMap::default(),
        }
    }

    /// Add one visible-label reference to a glyph, pinning it against eviction.
    /// No-op for glyphs not in the atlas (e.g. one that failed to allocate), so
    /// counts can never outlive a glyph.
    pub fn retain(&mut self, key: u64) {
        if self.glyph_map.contains_key(&key) {
            *self.ref_count.entry(key).or_insert(0) += 1;
            // Now reference-counted, so it no longer needs grace protection.
            self.pending.remove(&key);
        }
    }

    /// Drop one visible-label reference. Once the count reaches zero the glyph
    /// becomes unreferenced and eligible for eviction (which happens lazily,
    /// when the atlas next needs space — see [`Self::evict_unreferenced`]).
    pub fn release(&mut self, key: u64) {
        if let Some(count) = self.ref_count.get_mut(&key) {
            *count = count.saturating_sub(1);
            if *count == 0 {
                self.ref_count.remove(&key);
            }
        }
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
            self.ref_count.remove(&key);
            self.pending.remove(&key);
        }
    }

    /// Rasterize and pack any requested glyphs that aren't already in the
    /// atlas. Returns `true` if the atlas pixels or dimensions changed.
    ///
    /// `font_index` distinguishes glyphs from different fonts sharing this
    /// atlas. On allocator failure: evict unreferenced (off-screen) glyphs and
    /// retry, then grow and retry (capped at [`MAX_ATLAS_SIZE`]).
    ///
    /// Sets `*evicted` to `true` if any glyph was freed to make room, so the
    /// caller can invalidate the now-stale TS metrics for that atlas. Glyphs
    /// packed earlier in this same call are protected from eviction even though
    /// they have no references yet — the requesting label will retain them once
    /// the shaped result is applied.
    ///
    /// `raster_font` is only consulted for [`AtlasMode::Sdf`]; MSDF and Color
    /// work from `font_data`.
    pub fn ensure_glyphs_in_atlas(
        &mut self,
        raster_font: &fontdue::Font,
        font_data: &[u8],
        font_index: u32,
        glyph_ids: &[u32],
        evicted: &mut bool,
    ) -> bool {
        // Parse Face once per batch — per-glyph parsing dominated MSDF cost.
        let msdf_face = match self.mode {
            AtlasMode::Msdf => Face::parse(font_data, 0).ok(),
            AtlasMode::Sdf | AtlasMode::Color => None,
        };

        let pad = self.mode.padding();
        let mut new_glyphs = false;
        // Advance the call sequence so glyphs packed here are tagged with the
        // newest `pack_seq` and stay protected for the grace window below.
        self.pack_seq = self.pack_seq.wrapping_add(1);
        // Glyphs packed during this call have no references yet; protect them
        // so a later glyph in the same batch can't evict them before the
        // caller's label retains them.
        let mut just_added: FxHashSet<u64> = FxHashSet::default();
        for &glyph_id in glyph_ids {
            let key = composite_key(font_index, glyph_id);

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
                    *evicted |= self.evict_unreferenced(&just_added);
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
            just_added.insert(key);
            // Protect against eviction by later calls until the client retains
            // it (or it ages out of the grace window).
            self.pending.insert(key, self.pack_seq);
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

    /// Free every glyph with no visible-label references, so the freed rects
    /// can be reused. A glyph is kept if it is reference-counted, is in `protect`
    /// (packed earlier in the current shaping call), or was packed within the
    /// last [`EVICTION_GRACE_CALLS`] calls and is still awaiting the client's
    /// retain (see `pending`). Returns `true` if anything was evicted, so the
    /// caller can invalidate the now-stale TS metrics.
    fn evict_unreferenced(&mut self, protect: &FxHashSet<u64>) -> bool {
        let pack_seq = self.pack_seq;
        let evictable: Vec<u64> = self
            .glyph_map
            .keys()
            .copied()
            .filter(|key| {
                if self.ref_count.contains_key(key) || protect.contains(key) {
                    return false;
                }
                // Keep recently-packed glyphs until their retain can arrive.
                match self.pending.get(key) {
                    Some(&seq) => pack_seq.wrapping_sub(seq) >= EVICTION_GRACE_CALLS,
                    None => true,
                }
            })
            .collect();

        let evicted = !evictable.is_empty();
        for key in evictable {
            self.remove(key);
        }
        evicted
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Insert a glyph straight into the atlas (bypassing rasterization), tagged
    /// as pending at the current `pack_seq` — mirroring what
    /// `ensure_glyphs_in_atlas` records for a freshly-packed glyph.
    fn pack_fake(atlas: &mut Atlas, key: u64) {
        let alloc = atlas
            .allocator
            .allocate(Size::new(8, 8))
            .expect("fresh atlas has room");
        atlas.glyph_map.insert(
            key,
            GlyphMetrics {
                alloc_id: alloc.id,
                atlas_x: 0,
                atlas_y: 0,
                atlas_w: 4,
                atlas_h: 4,
                bearing_x: 0.0,
                bearing_y: 0.0,
            },
        );
        atlas.pending.insert(key, atlas.pack_seq);
    }

    fn no_protect() -> FxHashSet<u64> {
        FxHashSet::default()
    }

    #[test]
    fn grace_keeps_recent_glyph_then_evicts_after_window() {
        let mut atlas = Atlas::new(DEFAULT_ATLAS_SIZE, AtlasMode::Sdf);
        atlas.pack_seq = 1;
        pack_fake(&mut atlas, 42);

        // Still inside the grace window (age = GRACE - 1) → kept even though it
        // was never retained.
        atlas.pack_seq = EVICTION_GRACE_CALLS;
        assert!(!atlas.evict_unreferenced(&no_protect()));
        assert!(atlas.contains(42));

        // Aged out (age = GRACE) → now evictable.
        atlas.pack_seq = 1 + EVICTION_GRACE_CALLS;
        assert!(atlas.evict_unreferenced(&no_protect()));
        assert!(!atlas.contains(42));
    }

    #[test]
    fn retain_pins_glyph_and_clears_pending() {
        let mut atlas = Atlas::new(DEFAULT_ATLAS_SIZE, AtlasMode::Sdf);
        atlas.pack_seq = 1;
        pack_fake(&mut atlas, 7);

        atlas.retain(7);
        assert!(!atlas.pending.contains_key(&7), "retain clears pending");

        // Far past the grace window, but a referenced glyph is never evicted.
        atlas.pack_seq = 10 * EVICTION_GRACE_CALLS;
        assert!(!atlas.evict_unreferenced(&no_protect()));
        assert!(atlas.contains(7));

        // Released → unreferenced and (no longer pending) immediately evictable.
        atlas.release(7);
        assert!(atlas.evict_unreferenced(&no_protect()));
        assert!(!atlas.contains(7));
    }

    #[test]
    fn unpending_unreferenced_glyph_is_evictable() {
        let mut atlas = Atlas::new(DEFAULT_ATLAS_SIZE, AtlasMode::Sdf);
        atlas.pack_seq = 1;
        pack_fake(&mut atlas, 5);
        // A glyph that left the pending set without being retained (e.g. shaped
        // for a label that never became visible) is fair game right away.
        atlas.pending.remove(&5);
        assert!(atlas.evict_unreferenced(&no_protect()));
        assert!(!atlas.contains(5));
    }
}
