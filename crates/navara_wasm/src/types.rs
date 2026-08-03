use serde::Deserialize;
use wasm_bindgen::prelude::*;

/// Minimal discriminator that reads only a layer's `type` tag, so `add_layer`
/// can route the payload to the matching source-based builder.
#[wasm_bindgen]
#[derive(Debug, Clone, Deserialize)]
pub struct LayerDescription {
    #[wasm_bindgen(getter_with_clone)]
    pub r#type: Option<String>,
}

/// Re-extracts a source description's inline `data` field. `serde` skips it on
/// the typed source structs (it can be an arbitrary GeoJSON document), so the
/// geojson source builder reads it back through this shape.
#[wasm_bindgen]
#[derive(Debug, Clone, Deserialize)]
pub struct SourceData {
    #[wasm_bindgen(getter_with_clone)]
    #[serde(with = "serde_wasm_bindgen::preserve")]
    pub data: JsValue,
}

impl LayerDescription {
    pub fn from(value: JsValue) -> Option<Self> {
        serde_wasm_bindgen::from_value(value).ok()
    }
}
