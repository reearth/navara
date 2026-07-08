use wasm_bindgen::prelude::*;

use crate::{copy_f32_array, copy_f64_array, copy_u8_array, copy_u32_array};

/// A whole tile's parsed MVT groups transferred out of the parse worker.
///
/// The bulk geometry of every (layer, kind) group is packed into four
/// contiguous per-type streams (see `navara_parser::mvt::pack_parsed_mvt_groups`
/// for the segment order), so the postMessage transfer list carries exactly
/// four buffers per tile regardless of the group count. The tile meta
/// (`ParsedMvtTileMeta`: per-group headers plus per-layer property tables,
/// pre-serialized by the worker) rides along as a structured clone and lets
/// the main thread slice the streams back apart.
#[wasm_bindgen]
pub struct TransferableParsedMvtResult {
    f64_stream: Vec<f64>,
    f32_stream: Vec<f32>,
    u32_stream: Vec<u32>,
    u8_stream: Vec<u8>,
    meta: JsValue,
}

impl TransferableParsedMvtResult {
    pub fn new(
        f64_stream: Vec<f64>,
        f32_stream: Vec<f32>,
        u32_stream: Vec<u32>,
        u8_stream: Vec<u8>,
        meta: JsValue,
    ) -> Self {
        Self {
            f64_stream,
            f32_stream,
            u32_stream,
            u8_stream,
            meta,
        }
    }
}

#[wasm_bindgen]
impl TransferableParsedMvtResult {
    pub fn f64_stream(&self) -> js_sys::Float64Array {
        copy_f64_array(&self.f64_stream)
    }
    pub fn f32_stream(&self) -> js_sys::Float32Array {
        copy_f32_array(&self.f32_stream)
    }
    pub fn u32_stream(&self) -> js_sys::Uint32Array {
        copy_u32_array(&self.u32_stream)
    }
    pub fn u8_stream(&self) -> js_sys::Uint8Array {
        copy_u8_array(&self.u8_stream)
    }
    pub fn meta(&self) -> JsValue {
        self.meta.clone()
    }
}
