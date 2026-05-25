#![doc = include_str!("../README.md")]

pub mod atlas;
pub mod cache;
pub mod color_atlas;
pub mod color_raster;
pub mod msdf;
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

/// SDF/MSDF atlas data returned to TypeScript.
///
/// `channels` selects the GPU texture format on the JS side: 1 → R8 (SDF),
/// 3 → RGB8 (MSDF), 4 → RGBA8 (color glyphs).
#[wasm_bindgen(getter_with_clone)]
pub struct FontAtlas {
    pub data: js_sys::Uint8Array,
    pub width: u32,
    pub height: u32,
    pub channels: u32,
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
        let tick = self.tick;
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
            color_atlas.ensure_glyphs_in_atlas(font_data, font_index, &glyph_ids, tick)
        } else {
            // Split-borrow: `fonts` and `atlases` are separate fields so each
            // can be borrowed independently, letting us hand the immutable
            // font bytes + raster font to a mutable atlas method without
            // cloning the (potentially multi-MB) font buffer each call.
            let entry = self.fonts.get(url)?;
            let raster_font = &entry.raster_font;
            let font_data = entry.data.as_slice();
            let atlas = self.atlases.get_mut(&atlas_key)?;
            atlas.ensure_glyphs_in_atlas(raster_font, font_data, font_index, &glyph_ids, tick)
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
            channels: atlas.channels as u32,
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
            channels: 4,
        })
    }

    /// Advance the LRU tick counter. Called once per `prepareTextBatch`, so a
    /// tick is one batch — not a rendered frame (see [`LRU_MIN_AGE`]).
    #[wasm_bindgen(js_name = tick)]
    pub fn wasm_tick(&mut self) {
        self.tick += 1;
    }
}
