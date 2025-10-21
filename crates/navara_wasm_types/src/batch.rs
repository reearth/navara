use wasm_bindgen::prelude::*;

#[wasm_bindgen(getter_with_clone)]
pub struct BatchPropResult {
    pub properties: JsValue,
    #[wasm_bindgen(js_name = layerId)]
    pub layer_id: Option<String>,
}
