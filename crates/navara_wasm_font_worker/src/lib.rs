#![doc = include_str!("../README.md")]

pub mod atlas;
pub mod resource;
pub mod shaping;

use std::cell::RefCell;

use navara_wasm_utils::set_panic_hook;
pub use resource::{FontCache, FontEntry, GlyphMetrics, SDFAtlas};
use wasm_bindgen::prelude::*;

thread_local! {
    static FONT_CACHE: RefCell<FontCache> = RefCell::new(FontCache::default());
}

#[wasm_bindgen(start)]
pub fn start() {
    set_panic_hook();
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

// ---------------------------------------------------------------------------
// Helpers (inlined from navara_wasm_types/src/view.rs)
// ---------------------------------------------------------------------------

fn transfer_u8_array(byte_length: usize, f: &js_sys::Function) -> Vec<u8> {
    let buffer = vec![0; byte_length];
    unsafe {
        let array = js_sys::Uint8Array::view(&buffer);
        f.call1(&JsValue::NULL, &JsValue::from(array))
            .expect("The callback function should not throw");
    }
    buffer
}

fn copy_u8_array(buf: &[u8]) -> js_sys::Uint8Array {
    let array = js_sys::Uint8Array::new_with_length(buf.len() as u32);
    array.copy_from(buf);
    array
}

// ---------------------------------------------------------------------------
// Exposed WASM functions
// ---------------------------------------------------------------------------

/// Load font bytes into the FontCache.
/// Uses the same transfer-callback pattern as navara_wasm Core.loadFont.
#[wasm_bindgen(js_name = loadFont)]
pub fn load_font(url: String, byte_length: usize, f: &js_sys::Function) -> bool {
    let data = transfer_u8_array(byte_length, f);
    FONT_CACHE.with(|cache| cache.borrow_mut().insert(url, data).is_ok())
}

/// Unload a font from the FontCache, freeing its atlas memory.
#[wasm_bindgen(js_name = unloadFont)]
pub fn unload_font(url: String) -> bool {
    FONT_CACHE.with(|cache| cache.borrow_mut().remove(&url).is_ok())
}

/// Check if a font is loaded.
#[wasm_bindgen(js_name = isFontLoaded)]
pub fn is_font_loaded(url: &str) -> bool {
    FONT_CACHE.with(|cache| cache.borrow().is_loaded(url))
}

/// Shape text and ensure all glyphs are rasterized into the atlas.
/// Returns shaped glyphs + atlas metrics, or None if font isn't loaded.
#[wasm_bindgen(js_name = shapeText)]
pub fn shape_text(url: &str, text: &str) -> Option<ShapeTextResult> {
    FONT_CACHE.with(|cache| {
        let mut cache = cache.borrow_mut();
        let current_frame = cache.current_frame;
        let entry = cache.get_mut(url)?;

        let shaped = shaping::shape_text(&entry.data, text)?;
        let units_per_em = entry.units_per_em;

        let glyph_ids: Vec<u32> = shaped.iter().map(|g| g.glyph_id).collect();
        let atlas_changed = atlas::ensure_glyphs_in_atlas(
            &entry.raster_font,
            &glyph_ids,
            &mut entry.atlas,
            current_frame,
        );

        let glyphs: Vec<WasmShapedGlyph> = shaped
            .iter()
            .map(|g| WasmShapedGlyph {
                glyph_id: g.glyph_id,
                x_advance: g.x_advance,
                y_advance: g.y_advance,
                x_offset: g.x_offset,
                y_offset: g.y_offset,
            })
            .collect();

        // Only return metrics for glyphs in the shaped text (not entire atlas)
        let mut unique_ids = glyph_ids.clone();
        unique_ids.sort_unstable();
        unique_ids.dedup();

        let metrics: Vec<WasmGlyphMetrics> = unique_ids
            .iter()
            .filter_map(|&gid| {
                entry.atlas.glyph_map.get(&gid).map(|m| WasmGlyphMetrics {
                    glyph_id: gid,
                    atlas_x: m.atlas_x,
                    atlas_y: m.atlas_y,
                    atlas_w: m.atlas_w,
                    atlas_h: m.atlas_h,
                    bearing_x: m.bearing_x,
                    bearing_y: m.bearing_y,
                })
            })
            .collect();

        Some(ShapeTextResult {
            glyphs,
            metrics,
            units_per_em,
            atlas_changed,
        })
    })
}

/// Get the SDF atlas pixel data for a loaded font (copies into a new Uint8Array).
#[wasm_bindgen(js_name = getFontAtlas)]
pub fn get_font_atlas(url: &str) -> Option<FontAtlas> {
    FONT_CACHE.with(|cache| {
        let cache = cache.borrow();
        let entry = cache.get(url)?;
        Some(FontAtlas {
            data: copy_u8_array(&entry.atlas.pixel_data),
            width: entry.atlas.width,
            height: entry.atlas.height,
        })
    })
}

/// Increment the frame counter for LRU tracking.
#[wasm_bindgen(js_name = tickFrame)]
pub fn tick_frame() {
    FONT_CACHE.with(|cache| {
        cache.borrow_mut().current_frame += 1;
    });
}
