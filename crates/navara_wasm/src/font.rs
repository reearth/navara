use wasm_bindgen::prelude::*;

/// SDF atlas data returned to TypeScript.
/// Contains the RGBA pixel data and dimensions needed to create a GPU texture.
#[wasm_bindgen(getter_with_clone)]
pub struct FontAtlas {
    /// Raw RGBA pixel data
    pub data: js_sys::Uint8Array,
    /// Atlas width in pixels
    pub width: u32,
    /// Atlas height in pixels
    pub height: u32,
}

/// A single glyph's metrics in the atlas, returned to TypeScript.
#[wasm_bindgen]
#[derive(Clone)]
pub struct WasmGlyphMetrics {
    /// Glyph ID (post-shaping)
    pub glyph_id: u16,
    /// X position in atlas (pixels)
    pub atlas_x: i32,
    /// Y position in atlas (pixels)
    pub atlas_y: i32,
    /// Width in atlas (pixels)
    pub atlas_w: u32,
    /// Height in atlas (pixels)
    pub atlas_h: u32,
    /// Horizontal bearing
    pub bearing_x: f32,
    /// Vertical bearing
    pub bearing_y: f32,
    /// Horizontal advance
    pub advance: f32,
}

/// A single shaped glyph returned to TypeScript.
#[wasm_bindgen]
#[derive(Clone)]
pub struct WasmShapedGlyph {
    /// Glyph ID (use to look up atlas rect)
    pub glyph_id: u32,
    /// Horizontal advance (font units)
    pub x_advance: i32,
    /// Vertical advance (font units)
    pub y_advance: i32,
    /// Horizontal offset (font units)
    pub x_offset: i32,
    /// Vertical offset (font units)
    pub y_offset: i32,
    /// Cluster index into original text
    pub cluster: u32,
}

/// Result of shaping text: glyph positions + atlas metrics.
#[wasm_bindgen(getter_with_clone)]
pub struct ShapeTextResult {
    pub glyphs: Vec<WasmShapedGlyph>,
    pub metrics: Vec<WasmGlyphMetrics>,
    /// Font units per em (needed for converting font-unit advances to SDF pixel space)
    pub units_per_em: u16,
}
