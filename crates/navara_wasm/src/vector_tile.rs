use navara_tile_component::TileHandle;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct VectorTileState {
    #[wasm_bindgen(getter_with_clone)]
    pub layer_id: String,
    pub ready_parent_tile_handle: Option<TileHandle>,
    pub is_rendered: bool,
}
