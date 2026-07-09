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

    /// A zero-feature placeholder for completing the task lifecycle when the
    /// JS side fails after dispatch (worker error, BufferStore exhaustion,
    /// corrupt meta). The sentinel handles resolve to empty streams
    /// (`take_streams` falls back to empty vecs; `BufferStore::remove` on an
    /// absent handle is a no-op) and the empty meta finalizes zero groups, so
    /// the delegator is torn down normally instead of staying `Requested`
    /// forever and occupying one of the engine's pending parse slots.
    #[wasm_bindgen(js_name = empty)]
    pub fn empty() -> ParseMvtTileResult {
        // BufferStore handles start at 1, so a negative value is never live.
        const INVALID_HANDLE: i32 = -1;
        Self {
            f64_handle: INVALID_HANDLE,
            f32_handle: INVALID_HANDLE,
            u32_handle: INVALID_HANDLE,
            u8_handle: INVALID_HANDLE,
            meta: ParsedMvtTileMeta::default(),
        }
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

#[cfg(test)]
mod test {
    use navara_buffer_store::BufferStore;

    use super::ParseMvtTileResult;

    /// The failure placeholder must flow through the engine's finalize path
    /// without side effects: its sentinel handles resolve to empty streams,
    /// free nothing that is live, and its meta finalizes zero groups.
    #[test]
    fn it_should_resolve_the_failure_placeholder_to_empty_streams() {
        let mut buf = BufferStore::new();
        let live = buf.new_f64(vec![1.0]);

        let result: navara_worker::parse_mvt_tile::ParseMvtTileResult =
            ParseMvtTileResult::empty().into();
        let (f64s, f32s, u32s, u8s) = result.take_streams(&mut buf);

        assert!(f64s.is_empty());
        assert!(f32s.is_empty());
        assert!(u32s.is_empty());
        assert!(u8s.is_empty());
        assert!(result.meta.headers.is_empty());
        assert!(result.meta.layer_properties.is_empty());
        // Sentinel handles must never collide with a live entry.
        assert!(buf.get_f64(&live).is_some());
    }
}
