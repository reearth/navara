use navara_parser::mvt::ParsedMvtTileMeta;
use navara_wasm_types::ExtentRadianF32;
use serde::Serialize;
use wasm_bindgen::prelude::*;

/// Parameters sent to the MVT parse worker.
///
/// `configs_json` is a JSON-encoded `Vec<LayerParseConfig>`; the pbf bytes live
/// in the BufferStore under `pbf_handle` and are resolved to a transferable
/// `Uint8Array` on the JS side before invoking the worker.
#[wasm_bindgen]
#[derive(Clone, Debug, Serialize)]
pub struct ParseMvtTileParameters {
    pub pbf_handle: i32,
    pub x: u32,
    pub y: u32,
    pub z: u32,
    pub tile_extent: Option<ExtentRadianF32>,
    /// Tile-payload compression code (0 = none/plain); the worker decompresses.
    pub compression: u8,
    #[wasm_bindgen(getter_with_clone)]
    pub configs_json: String,
}

impl<'a> From<&'a navara_worker::parse_mvt_tile::ParseMvtTileParameters>
    for ParseMvtTileParameters
{
    fn from(v: &'a navara_worker::parse_mvt_tile::ParseMvtTileParameters) -> Self {
        ParseMvtTileParameters {
            pbf_handle: v.pbf_handle,
            x: v.x as u32,
            y: v.y as u32,
            z: v.z as u32,
            tile_extent: v.tile_extent.map(|t| (&t).into()),
            compression: v.compression,
            configs_json: serde_json::to_string(&v.configs).unwrap_or_else(|_| "[]".to_string()),
        }
    }
}

/// Parsed tile handed back from the worker round trip. The JS side stores the
/// four packed streams in the `BufferStore` (via `newBufferF64` etc., which
/// write straight into WASM memory) and passes only their handles here, along
/// with the structured-clone tile meta (per-group headers + per-layer property
/// tables).
#[wasm_bindgen]
#[derive(Debug, Clone)]
pub struct ParseMvtTileResult {
    f64_handle: i32,
    f32_handle: i32,
    u32_handle: i32,
    u8_handle: i32,
    meta: ParsedMvtTileMeta,
}

#[wasm_bindgen]
impl ParseMvtTileResult {
    /// `meta` is a serialized `ParsedMvtTileMeta` produced by the parse worker;
    /// it must describe the same streams the handles point to.
    #[wasm_bindgen(constructor)]
    pub fn new(
        f64_handle: i32,
        f32_handle: i32,
        u32_handle: i32,
        u8_handle: i32,
        meta: JsValue,
    ) -> Result<ParseMvtTileResult, JsValue> {
        let meta: ParsedMvtTileMeta = serde_wasm_bindgen::from_value(meta)?;
        Ok(Self {
            f64_handle,
            f32_handle,
            u32_handle,
            u8_handle,
            meta,
        })
    }
}

impl From<ParseMvtTileResult> for navara_worker::parse_mvt_tile::ParseMvtTileResult {
    fn from(v: ParseMvtTileResult) -> Self {
        navara_worker::parse_mvt_tile::ParseMvtTileResult {
            f64_handle: v.f64_handle,
            f32_handle: v.f32_handle,
            u32_handle: v.u32_handle,
            u8_handle: v.u8_handle,
            meta: v.meta,
        }
    }
}

impl<'a> From<&'a navara_worker::parse_mvt_tile::ParseMvtTileResult> for ParseMvtTileResult {
    fn from(v: &'a navara_worker::parse_mvt_tile::ParseMvtTileResult) -> Self {
        ParseMvtTileResult {
            f64_handle: v.f64_handle,
            f32_handle: v.f32_handle,
            u32_handle: v.u32_handle,
            u8_handle: v.u8_handle,
            meta: v.meta.clone(),
        }
    }
}
