use wasm_bindgen::prelude::*;

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
    pub atlas_x: i32,
    pub atlas_y: i32,
    pub atlas_w: u32,
    pub atlas_h: u32,
    pub bearing_x: f32,
    pub bearing_y: f32,
}

/// A single shaped glyph with positioning info.
#[wasm_bindgen]
#[derive(Clone)]
pub struct WasmShapedGlyph {
    pub glyph_id: u32,
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
    pub atlas_changed: bool,
}
