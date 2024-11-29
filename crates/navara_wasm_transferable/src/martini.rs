use navara_tile_component::MartiniComponent;
use wasm_bindgen::prelude::wasm_bindgen;

#[wasm_bindgen]
pub struct TransferableMartini {
    pub size: u32,
    #[wasm_bindgen(getter_with_clone)]
    pub coords: Vec<u32>,
}

#[wasm_bindgen]
impl TransferableMartini {
    #[wasm_bindgen(constructor)]
    pub fn new(size: u32, coords: Vec<u32>) -> Self {
        Self { size, coords }
    }
}

impl<'a> From<&'a MartiniComponent> for TransferableMartini {
    fn from(value: &'a MartiniComponent) -> Self {
        let m = value.get();
        Self {
            size: m.size,
            coords: m.coords.clone(),
        }
    }
}

impl From<TransferableMartini> for MartiniComponent {
    fn from(value: TransferableMartini) -> Self {
        Self::with_coords(value.size, value.coords)
    }
}
