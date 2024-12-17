use navara_math::FloatType;
use wasm_bindgen::prelude::*;

use crate::consume_vec;

#[wasm_bindgen]
#[derive(Clone, Debug, Default, PartialEq)]
pub struct FloatAttribute {
    #[wasm_bindgen(getter_with_clone)]
    pub data: Vec<FloatType>,
    pub size: u8,
}

#[wasm_bindgen]
impl FloatAttribute {
    #[wasm_bindgen(constructor)]
    pub fn new(data: Vec<FloatType>, size: u8) -> Self {
        Self { data, size }
    }

    #[wasm_bindgen(js_name = "transferData")]
    pub fn transfer_data(&mut self) -> Vec<FloatType> {
        consume_vec(&mut self.data)
    }
}

impl From<FloatAttribute> for navara_geometry::FloatAttribute {
    fn from(val: FloatAttribute) -> Self {
        navara_geometry::FloatAttribute {
            data: val.data,
            size: val.size,
        }
    }
}
impl From<navara_geometry::FloatAttribute> for FloatAttribute {
    fn from(val: navara_geometry::FloatAttribute) -> Self {
        FloatAttribute {
            data: val.data,
            size: val.size,
        }
    }
}
