use js_sys::Uint32Array;
use navara_tile_component::MartiniComponent;
use navara_wasm_types::copy_u32_array;
use wasm_bindgen::prelude::wasm_bindgen;

#[wasm_bindgen]
pub struct TransferableMartini {
    pub size: u32,
    pub(crate) coords: Vec<u32>,
}

#[wasm_bindgen]
impl TransferableMartini {
    #[wasm_bindgen(constructor)]
    pub fn new(size: u32, coords: Vec<u32>) -> Self {
        Self { size, coords }
    }

    pub fn transfer_coords(&self) -> Uint32Array {
        copy_u32_array(&self.coords)
    }

    #[wasm_bindgen(js_name = "fromSize")]
    pub fn from_size(size: u32) -> Self {
        let mut c = MartiniComponent::new(size);

        let martini_coords = &mut c.get_mut().coords;
        let mut coords = Vec::with_capacity(martini_coords.len());
        coords.append(martini_coords);

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
