#![doc = include_str!("../README.md")]

pub mod atlas;
pub mod cache;
pub mod color_raster;
pub mod msdf;
pub mod shaping;

pub use atlas::{Atlas, GlyphMetrics};
pub use cache::{FontCache, FontEntry};
use navara_wasm_types::{copy_u8_array, transfer_u8_array};
use navara_wasm_utils::set_panic_hook;
use wasm_bindgen::prelude::*;

#[wasm_bindgen(start)]
pub fn start() {
    set_panic_hook();
}

/// Pack `(font_index, glyph_id)` into a u64. Exported so TS uses the same
/// layout as Rust.
#[wasm_bindgen]
pub fn composite_key(font_index: u32, glyph_id: u32) -> u64 {
    atlas::composite_key(font_index, glyph_id)
}

// ---------------------------------------------------------------------------
// WASM types
// ---------------------------------------------------------------------------

/// Atlas bytes returned to TypeScript. `channels`: 1 → R8 (SDF),
/// 4 → RGBA8 (MSDF or color).
#[wasm_bindgen(getter_with_clone)]
pub struct FontAtlas {
    pub data: js_sys::Uint8Array,
    pub width: u32,
    pub height: u32,
    pub channels: u32,
}

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
    /// True when the glyph lives in the COLRv1 RGBA atlas rather than the SDF.
    pub is_color: bool,
}

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

#[wasm_bindgen(getter_with_clone)]
pub struct ShapeTextResult {
    pub glyphs: Vec<WasmShapedGlyph>,
    pub metrics: Vec<WasmGlyphMetrics>,
    pub units_per_em: u16,
    pub font_index: u32,
    pub atlas_changed: bool,
    /// True when this font is COLRv1 — glyphs were packed into the color atlas.
    pub is_color: bool,
}

// ---------------------------------------------------------------------------
// WASM methods on FontCache
// ---------------------------------------------------------------------------

/// Look up an atlas by key, falling back to the font URL → atlas_key map.
fn lookup_atlas<'a>(
    atlases: &'a std::collections::HashMap<String, Atlas>,
    fonts: &std::collections::HashMap<String, cache::FontEntry>,
    key: &str,
) -> Option<&'a Atlas> {
    atlases
        .get(key)
        .or_else(|| atlases.get(&fonts.get(key)?.atlas_key))
}

fn snapshot_atlas(atlas: &Atlas) -> FontAtlas {
    FontAtlas {
        data: copy_u8_array(&atlas.pixel_data),
        width: atlas.width,
        height: atlas.height,
        channels: atlas.channels as u32,
    }
}

#[wasm_bindgen]
impl FontCache {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self::default()
    }

    /// Load font bytes into the cache.
    ///
    /// `atlas_key`: shared atlas identifier (e.g. family name). Omit to get a
    /// per-URL atlas.
    /// `mode`: `"msdf"` → MTSDF; anything else (including `None`) → SDF.
    /// Mirrors the TS `quality: "low" | "high"` knob.
    #[wasm_bindgen(js_name = loadFont)]
    pub fn wasm_load_font(
        &mut self,
        url: String,
        byte_length: usize,
        f: &js_sys::Function,
        atlas_key: Option<String>,
        mode: Option<String>,
    ) -> bool {
        let data = transfer_u8_array(byte_length, f);
        let mode = match mode.as_deref() {
            Some("msdf") => crate::atlas::AtlasMode::Msdf,
            _ => crate::atlas::AtlasMode::Sdf,
        };
        self.load_font(url, data, atlas_key, mode).is_ok()
    }

    #[wasm_bindgen(js_name = getAtlasKey)]
    pub fn wasm_get_atlas_key(&self, url: &str) -> Option<String> {
        self.get_atlas_key(url).map(|s| s.to_owned())
    }

    #[wasm_bindgen(js_name = unloadFont)]
    pub fn wasm_unload_font(&mut self, url: String) -> bool {
        self.unload_font(&url).is_ok()
    }

    #[wasm_bindgen(js_name = isFontLoaded)]
    pub fn wasm_is_font_loaded(&self, url: &str) -> bool {
        self.is_font_loaded(url)
    }

    /// Shape `text` and ensure every glyph is in the appropriate atlas (SDF
    /// for monochrome fonts, RGBA for COLRv1 fonts).
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

        // Split-borrow: hand the immutable font bytes to a mutable atlas
        // method without cloning the (possibly multi-MB) buffer.
        let entry = self.fonts.get(url)?;
        let raster_font = &entry.raster_font;
        let font_data = entry.data.as_slice();
        let atlases = if is_color {
            &mut self.color_atlases
        } else {
            &mut self.atlases
        };
        let atlas = atlases.get_mut(&atlas_key)?;
        let atlas_changed =
            atlas.ensure_glyphs_in_atlas(raster_font, font_data, font_index, &glyph_ids, tick);

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

        let mut unique_ids = glyph_ids;
        unique_ids.sort_unstable();
        unique_ids.dedup();

        let atlas_ref = if is_color {
            self.color_atlases.get(&atlas_key)?
        } else {
            self.atlases.get(&atlas_key)?
        };
        let metrics: Vec<WasmGlyphMetrics> = unique_ids
            .iter()
            .filter_map(|&gid| {
                let m = atlas_ref.get_metrics(atlas::composite_key(font_index, gid))?;
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

    /// SDF atlas bytes by atlas key or font URL.
    #[wasm_bindgen(js_name = getFontAtlas)]
    pub fn wasm_get_font_atlas(&self, key: &str) -> Option<FontAtlas> {
        lookup_atlas(&self.atlases, &self.fonts, key).map(snapshot_atlas)
    }

    /// RGBA color atlas bytes by atlas key or font URL. `None` if no COLRv1
    /// face has been loaded under this key.
    #[wasm_bindgen(js_name = getColorAtlas)]
    pub fn wasm_get_color_atlas(&self, key: &str) -> Option<FontAtlas> {
        lookup_atlas(&self.color_atlases, &self.fonts, key).map(snapshot_atlas)
    }

    /// Advance the LRU clock. Called once per `prepareTextBatch` — not per
    /// rendered frame (see [`LRU_MIN_AGE`]).
    #[wasm_bindgen(js_name = tick)]
    pub fn wasm_tick(&mut self) {
        self.tick += 1;
    }
}
