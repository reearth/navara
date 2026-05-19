#![doc = include_str!("../README.md")]

pub mod atlas;
pub mod cache;
pub mod color_atlas;
pub mod color_curve_atlas;
pub mod color_raster;
pub mod curve_atlas;
pub mod curves;
pub mod shaping;

pub use atlas::{GlyphMetrics, SDFAtlas};
pub use cache::{FontCache, FontEntry};
use navara_wasm_types::{copy_u8_array, transfer_u8_array};
use navara_wasm_utils::set_panic_hook;
use wasm_bindgen::prelude::*;

#[wasm_bindgen(start)]
pub fn start() {
    set_panic_hook();
}

/// Pack a font index and glyph ID into a single u64 composite key.
/// Exposed to TypeScript so both sides use the same key layout.
#[wasm_bindgen]
pub fn composite_key(font_index: u32, glyph_id: u32) -> u64 {
    atlas::composite_key(font_index, glyph_id)
}

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}

// ---------------------------------------------------------------------------
// WASM types
// ---------------------------------------------------------------------------

/// SDF atlas data returned to TypeScript.
#[wasm_bindgen(getter_with_clone)]
pub struct FontAtlas {
    pub data: js_sys::Uint8Array,
    pub width: u32,
    pub height: u32,
}

/// A single glyph's metrics in the atlas.
#[wasm_bindgen]
#[derive(Clone)]
pub struct WasmGlyphMetrics {
    pub glyph_id: u32,
    pub font_index: u32,
    pub atlas_x: i32,
    pub atlas_y: i32,
    pub atlas_w: u32,
    pub atlas_h: u32,
    pub bearing_x: f32,
    pub bearing_y: f32,
    /// True when the glyph lives in the COLRv1 color atlas (RGBA) rather than
    /// the monochrome SDF atlas. TS samples the correct texture accordingly.
    pub is_color: bool,
}

/// A single shaped glyph with positioning info.
#[wasm_bindgen]
#[derive(Clone)]
pub struct WasmShapedGlyph {
    pub glyph_id: u32,
    pub font_index: u32,
    pub x_advance: i32,
    pub y_advance: i32,
    pub x_offset: i32,
    pub y_offset: i32,
}

/// Result of shaping text: glyph positions + atlas metrics.
#[wasm_bindgen(getter_with_clone)]
pub struct ShapeTextResult {
    pub glyphs: Vec<WasmShapedGlyph>,
    pub metrics: Vec<WasmGlyphMetrics>,
    pub units_per_em: u16,
    pub font_index: u32,
    pub atlas_changed: bool,
    /// True when the shaped font is a COLRv1 color font. Glyphs were packed
    /// into the color atlas (RGBA) instead of the SDF atlas (R8).
    pub is_color: bool,
}

// ---------------------------------------------------------------------------
// WASM methods on FontCache
// ---------------------------------------------------------------------------

#[wasm_bindgen]
impl FontCache {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self::default()
    }

    /// Load font bytes into the cache.
    ///
    /// `atlas_key`: optional shared atlas identifier (e.g. font family name).
    /// When provided, all fonts loaded with the same key share a single SDF atlas.
    /// When omitted, the font gets its own atlas keyed by URL.
    #[wasm_bindgen(js_name = loadFont)]
    pub fn wasm_load_font(
        &mut self,
        url: String,
        byte_length: usize,
        f: &js_sys::Function,
        atlas_key: Option<String>,
    ) -> bool {
        let data = transfer_u8_array(byte_length, f);
        self.load_font(url, data, atlas_key).is_ok()
    }

    /// Get the atlas key for a loaded font (family name or URL).
    #[wasm_bindgen(js_name = getAtlasKey)]
    pub fn wasm_get_atlas_key(&self, url: &str) -> Option<String> {
        self.get_atlas_key(url).map(|s| s.to_owned())
    }

    /// Unload a font from the cache, freeing its atlas memory.
    #[wasm_bindgen(js_name = unloadFont)]
    pub fn wasm_unload_font(&mut self, url: String) -> bool {
        self.unload_font(&url).is_ok()
    }

    /// Check if a font is loaded.
    #[wasm_bindgen(js_name = isFontLoaded)]
    pub fn wasm_is_font_loaded(&self, url: &str) -> bool {
        self.is_font_loaded(url)
    }

    /// Shape text and ensure all glyphs are rasterized into the appropriate
    /// atlas (SDF for monochrome fonts, color for COLRv1 fonts).
    #[wasm_bindgen(js_name = shapeText)]
    pub fn wasm_shape_text(&mut self, url: &str, text: &str) -> Option<ShapeTextResult> {
        let current_frame = self.current_frame;
        let entry = self.fonts.get(url)?;

        let shaped = shaping::shape_text(&entry.data, text)?;
        let units_per_em = entry.units_per_em;
        let atlas_key = entry.atlas_key.clone();
        let font_index = entry.font_index;
        let is_color = entry.is_color;

        let glyph_ids: Vec<u32> = shaped.iter().map(|g| g.glyph_id).collect();

        let atlas_changed = if is_color {
            let font_data = &self.fonts.get(url)?.data;
            let color_atlas = self.color_atlases.get_mut(&atlas_key)?;
            color_atlas.ensure_glyphs_in_atlas(font_data, font_index, &glyph_ids, current_frame)
        } else {
            let raster_font = &self.fonts.get(url)?.raster_font;
            let atlas = self.atlases.get_mut(&atlas_key)?;
            atlas.ensure_glyphs_in_atlas(raster_font, font_index, &glyph_ids, current_frame)
        };

        let glyphs: Vec<WasmShapedGlyph> = shaped
            .iter()
            .map(|g| WasmShapedGlyph {
                glyph_id: g.glyph_id,
                font_index,
                x_advance: g.x_advance,
                y_advance: g.y_advance,
                x_offset: g.x_offset,
                y_offset: g.y_offset,
            })
            .collect();

        let mut unique_ids = glyph_ids.clone();
        unique_ids.sort_unstable();
        unique_ids.dedup();

        let metrics: Vec<WasmGlyphMetrics> = unique_ids
            .iter()
            .filter_map(|&gid| {
                let key = atlas::composite_key(font_index, gid);
                let m = if is_color {
                    self.color_atlases.get(&atlas_key)?.get_metrics(key)?
                } else {
                    self.atlases.get(&atlas_key)?.get_metrics(key)?
                };
                Some(WasmGlyphMetrics {
                    glyph_id: gid,
                    font_index,
                    atlas_x: m.atlas_x,
                    atlas_y: m.atlas_y,
                    atlas_w: m.atlas_w,
                    atlas_h: m.atlas_h,
                    bearing_x: m.bearing_x,
                    bearing_y: m.bearing_y,
                    is_color,
                })
            })
            .collect();

        Some(ShapeTextResult {
            glyphs,
            metrics,
            units_per_em,
            font_index,
            atlas_changed,
            is_color,
        })
    }

    /// Get the SDF atlas pixel data by atlas key (family name or font URL).
    /// Falls back to looking up the atlas key via font URL if a direct key match isn't found.
    #[wasm_bindgen(js_name = getFontAtlas)]
    pub fn wasm_get_font_atlas(&self, key: &str) -> Option<FontAtlas> {
        // Try direct atlas key lookup first, then resolve via font URL
        let atlas = self.atlases.get(key).or_else(|| {
            let entry = self.fonts.get(key)?;
            self.atlases.get(&entry.atlas_key)
        })?;
        Some(FontAtlas {
            data: copy_u8_array(&atlas.pixel_data),
            width: atlas.width,
            height: atlas.height,
        })
    }

    /// Get the RGBA color atlas pixel data by atlas key (family name or font URL).
    /// Returns `None` if the key has no color atlas (i.e. no COLRv1 face was loaded for it).
    #[wasm_bindgen(js_name = getColorAtlas)]
    pub fn wasm_get_color_atlas(&self, key: &str) -> Option<FontAtlas> {
        let atlas = self.color_atlases.get(key).or_else(|| {
            let entry = self.fonts.get(key)?;
            self.color_atlases.get(&entry.atlas_key)
        })?;
        Some(FontAtlas {
            data: copy_u8_array(&atlas.pixel_data),
            width: atlas.width,
            height: atlas.height,
        })
    }

    /// Increment the frame counter for LRU tracking.
    #[wasm_bindgen(js_name = tickFrame)]
    pub fn wasm_tick_frame(&mut self) {
        self.current_frame += 1;
    }

    /// Walk every curve atlas and color curve atlas, evicting glyphs that
    /// haven't been used for at least [`crate::cache::LRU_MIN_AGE`] frames.
    /// Run from the worker's per-frame tick so the GPU buffers don't grow
    /// indefinitely under sustained label streaming. Paired atlases (a font
    /// family with both outline + COLR faces) are evicted via
    /// [`color_curve_atlas::evict_cold_pair`] so the "color binding ⇔ color
    /// record" invariant is preserved.
    #[wasm_bindgen(js_name = evictColdCurveGlyphs)]
    pub fn wasm_evict_cold_curve_glyphs(&mut self) {
        let current_frame = self.current_frame;
        let min_age = cache::LRU_MIN_AGE;
        let keys: Vec<String> = self.curve_atlases.keys().cloned().collect();
        for key in keys {
            if self.color_curve_atlases.contains_key(&key) {
                if let Some(outline) = self.curve_atlases.get_mut(&key)
                    && let Some(color) = self.color_curve_atlases.get_mut(&key)
                {
                    color_curve_atlas::evict_cold_pair(color, outline, current_frame, min_age);
                }
            } else if let Some(outline) = self.curve_atlases.get_mut(&key) {
                outline.evict_cold(current_frame, min_age);
            }
        }
    }

    // -----------------------------------------------------------------------
    // Slug-style curve pipeline (parallel to the SDF API above).
    // -----------------------------------------------------------------------

    /// Shape `text` and ensure every glyph is resident in the Slug-style
    /// outline + (optional) color buffer pools. Returns per-glyph positioning
    /// plus the `header_slot` index each glyph occupies in the outline atlas
    /// — the vertex shader uses this as the glyph's instance attribute.
    #[wasm_bindgen(js_name = shapeTextCurves)]
    pub fn wasm_shape_text_curves(
        &mut self,
        url: &str,
        text: &str,
    ) -> Option<ShapeTextCurvesResult> {
        let current_frame = self.current_frame;
        let entry = self.fonts.get(url)?;

        let shaped = shaping::shape_text(&entry.data, text)?;
        let units_per_em = entry.units_per_em;
        let atlas_key = entry.atlas_key.clone();
        let font_index = entry.font_index;
        let is_color = entry.is_color;
        let font_bytes = entry.data.clone();

        let glyph_ids: Vec<u32> = shaped.iter().map(|g| g.glyph_id).collect();
        let mut unique_ids: Vec<u32> = glyph_ids.clone();
        unique_ids.sort_unstable();
        unique_ids.dedup();

        let mut atlas_changed = false;

        // Parse the font once for both populate calls; we hand &FontRef to
        // each atlas rather than re-parsing.
        let font = skrifa::prelude::FontRef::new(&font_bytes).ok()?;

        // Outline atlas — always populated, even for COLR fonts (the color
        // pipeline reuses these for clip-glyph dereferencing).
        {
            let curve = self.curve_atlases.get_mut(&atlas_key)?;
            atlas_changed |= curve.ensure_glyphs(&font, font_index, &unique_ids, current_frame);
        }

        // Color atlas (when applicable) — populates dependent outline glyphs
        // too via a temporary back-reference. Field-level disjoint borrow.
        if is_color
            && let Some(outline) = self.curve_atlases.get_mut(&atlas_key)
            && let Some(color) = self.color_curve_atlases.get_mut(&atlas_key)
        {
            atlas_changed |=
                color.ensure_color_glyphs(outline, &font, font_index, &unique_ids, current_frame);
        }

        // Build per-glyph results carrying the header_slot.
        let curve = self.curve_atlases.get(&atlas_key)?;
        let glyphs: Vec<WasmShapedCurveGlyph> = shaped
            .iter()
            .map(|g| {
                let slot = curve
                    .get_record(curve_atlas::composite_key(font_index, g.glyph_id))
                    .map(|r| r.header_slot)
                    .unwrap_or(u32::MAX);
                WasmShapedCurveGlyph {
                    glyph_id: g.glyph_id,
                    font_index,
                    header_slot: slot,
                    x_advance: g.x_advance,
                    y_advance: g.y_advance,
                    x_offset: g.x_offset,
                    y_offset: g.y_offset,
                }
            })
            .collect();

        Some(ShapeTextCurvesResult {
            glyphs,
            units_per_em,
            font_index,
            atlas_changed,
            is_color,
        })
    }

    // -- Outline buffer accessors. Each returns the full backing buffer as a
    //    zero-copy `Uint32Array` / `Float32Array` view. The JS side combines
    //    these with `getCurveDirtyRanges` for incremental uploads.

    #[wasm_bindgen(js_name = getGlyphHeaderBuffer)]
    pub fn wasm_get_glyph_header_buffer(&self, key: &str) -> Option<js_sys::Float32Array> {
        let atlas = self.get_curve_atlas(key)?;
        Some(navara_wasm_types::copy_f32_array(&atlas.glyph_headers))
    }

    #[wasm_bindgen(js_name = getBandDataBuffer)]
    pub fn wasm_get_band_data_buffer(&self, key: &str) -> Option<js_sys::Uint32Array> {
        let atlas = self.get_curve_atlas(key)?;
        Some(navara_wasm_types::copy_u32_array(&atlas.band_data))
    }

    #[wasm_bindgen(js_name = getBandCurvesBuffer)]
    pub fn wasm_get_band_curves_buffer(&self, key: &str) -> Option<js_sys::Uint32Array> {
        let atlas = self.get_curve_atlas(key)?;
        Some(navara_wasm_types::copy_u32_array(&atlas.band_curves))
    }

    #[wasm_bindgen(js_name = getCurveDataBuffer)]
    pub fn wasm_get_curve_data_buffer(&self, key: &str) -> Option<js_sys::Float32Array> {
        let atlas = self.get_curve_atlas(key)?;
        Some(navara_wasm_types::copy_f32_array(&atlas.curve_data))
    }

    /// Returns and resets the dirty ranges on the four outline buffers. JS
    /// uses these to drive `texSubImage` uploads rather than re-uploading the
    /// whole buffer every frame. `None` means "buffer unchanged this frame".
    #[wasm_bindgen(js_name = takeCurveDirtyRanges)]
    pub fn wasm_take_curve_dirty_ranges(&mut self, key: &str) -> Option<CurveDirtyRanges> {
        let atlas = self.get_curve_atlas_mut(key)?;
        let d = atlas.take_dirty_ranges();
        Some(CurveDirtyRanges {
            headers_start: d.headers.as_ref().map(|r| r.start).unwrap_or(0),
            headers_end: d.headers.as_ref().map(|r| r.end).unwrap_or(0),
            bands_start: d.bands.as_ref().map(|r| r.start).unwrap_or(0),
            bands_end: d.bands.as_ref().map(|r| r.end).unwrap_or(0),
            band_curves_start: d.band_curves.as_ref().map(|r| r.start).unwrap_or(0),
            band_curves_end: d.band_curves.as_ref().map(|r| r.end).unwrap_or(0),
            curves_start: d.curves.as_ref().map(|r| r.start).unwrap_or(0),
            curves_end: d.curves.as_ref().map(|r| r.end).unwrap_or(0),
            headers_changed: d.headers.is_some(),
            bands_changed: d.bands.is_some(),
            band_curves_changed: d.band_curves.is_some(),
            curves_changed: d.curves.is_some(),
        })
    }

    // -- Color (COLRv1) buffer accessors. Returns `None` when the atlas has
    //    no color faces.

    #[wasm_bindgen(js_name = getColorLayerHeaderBuffer)]
    pub fn wasm_get_color_layer_header_buffer(&self, key: &str) -> Option<js_sys::Uint32Array> {
        let atlas = self.get_color_curve_atlas(key)?;
        Some(navara_wasm_types::copy_u32_array(&atlas.layer_headers))
    }

    #[wasm_bindgen(js_name = getColorPaintParamsBuffer)]
    pub fn wasm_get_color_paint_params_buffer(&self, key: &str) -> Option<js_sys::Float32Array> {
        let atlas = self.get_color_curve_atlas(key)?;
        Some(navara_wasm_types::copy_f32_array(&atlas.paint_params))
    }

    #[wasm_bindgen(js_name = getColorClipRecordsBuffer)]
    pub fn wasm_get_color_clip_records_buffer(&self, key: &str) -> Option<js_sys::Uint32Array> {
        let atlas = self.get_color_curve_atlas(key)?;
        Some(navara_wasm_types::copy_u32_array(&atlas.clip_records))
    }

    #[wasm_bindgen(js_name = takeColorDirtyRanges)]
    pub fn wasm_take_color_dirty_ranges(&mut self, key: &str) -> Option<ColorDirtyRangesJs> {
        let atlas = self.get_color_curve_atlas_mut(key)?;
        let d = atlas.take_dirty_ranges();
        Some(ColorDirtyRangesJs {
            layer_headers_start: d.layer_headers.as_ref().map(|r| r.start).unwrap_or(0),
            layer_headers_end: d.layer_headers.as_ref().map(|r| r.end).unwrap_or(0),
            paint_params_start: d.paint_params.as_ref().map(|r| r.start).unwrap_or(0),
            paint_params_end: d.paint_params.as_ref().map(|r| r.end).unwrap_or(0),
            clip_records_start: d.clip_records.as_ref().map(|r| r.start).unwrap_or(0),
            clip_records_end: d.clip_records.as_ref().map(|r| r.end).unwrap_or(0),
            layer_headers_changed: d.layer_headers.is_some(),
            paint_params_changed: d.paint_params.is_some(),
            clip_records_changed: d.clip_records.is_some(),
        })
    }
}

// ---------------------------------------------------------------------------
// Slug-style result + dirty-range types
// ---------------------------------------------------------------------------

#[wasm_bindgen]
#[derive(Clone)]
pub struct WasmShapedCurveGlyph {
    pub glyph_id: u32,
    pub font_index: u32,
    /// Slot index in the outline atlas's `glyph_headers` buffer. The vertex
    /// shader uses this as the instance attribute and `texelFetch`es header
    /// fields directly. `u32::MAX` if the glyph couldn't be inserted.
    pub header_slot: u32,
    pub x_advance: i32,
    pub y_advance: i32,
    pub x_offset: i32,
    pub y_offset: i32,
}

#[wasm_bindgen(getter_with_clone)]
pub struct ShapeTextCurvesResult {
    pub glyphs: Vec<WasmShapedCurveGlyph>,
    pub units_per_em: u16,
    pub font_index: u32,
    /// True if any new glyph was added to either the outline or color buffer
    /// pool. JS uses this to skip the dirty-range query on quiescent frames.
    pub atlas_changed: bool,
    pub is_color: bool,
}

#[wasm_bindgen]
#[derive(Clone, Copy)]
pub struct CurveDirtyRanges {
    pub headers_start: u32,
    pub headers_end: u32,
    pub bands_start: u32,
    pub bands_end: u32,
    pub band_curves_start: u32,
    pub band_curves_end: u32,
    pub curves_start: u32,
    pub curves_end: u32,
    pub headers_changed: bool,
    pub bands_changed: bool,
    pub band_curves_changed: bool,
    pub curves_changed: bool,
}

#[wasm_bindgen]
#[derive(Clone, Copy)]
pub struct ColorDirtyRangesJs {
    pub layer_headers_start: u32,
    pub layer_headers_end: u32,
    pub paint_params_start: u32,
    pub paint_params_end: u32,
    pub clip_records_start: u32,
    pub clip_records_end: u32,
    pub layer_headers_changed: bool,
    pub paint_params_changed: bool,
    pub clip_records_changed: bool,
}
