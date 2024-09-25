use navara_buffer_store::Handle;
use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize)]
pub struct TransferableFloatAttribute {
    #[wasm_bindgen(getter_with_clone)]
    pub data: Handle,
    pub size: u8,
}
impl From<TransferableFloatAttribute> for navara_geometry::TransferableFloatAttribute {
    fn from(val: TransferableFloatAttribute) -> Self {
        navara_geometry::TransferableFloatAttribute {
            data: val.data,
            size: val.size,
        }
    }
}
impl<'a> From<&'a navara_geometry::TransferableFloatAttribute> for TransferableFloatAttribute {
    fn from(val: &'a navara_geometry::TransferableFloatAttribute) -> TransferableFloatAttribute {
        TransferableFloatAttribute {
            data: val.data,
            size: val.size,
        }
    }
}
