use wasm_bindgen::prelude::*;

use crate::{copy_f32_array, copy_u32_array};

#[wasm_bindgen]
#[derive(Clone, Debug, Default, PartialEq)]
pub struct FloatAttribute {
    pub(crate) data: Vec<f32>,
    pub size: u8,
}

#[wasm_bindgen]
impl FloatAttribute {
    #[wasm_bindgen(constructor)]
    pub fn new(data: Vec<f32>, size: u8) -> Self {
        Self { data, size }
    }

    #[wasm_bindgen(js_name = "transferData")]
    pub fn transfer_data(&mut self) -> js_sys::Float32Array {
        copy_f32_array(&self.data)
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

#[wasm_bindgen]
#[derive(Clone, Debug, Default, PartialEq)]
pub struct UintAttribute {
    pub(crate) data: Vec<u32>,
    pub size: u8,
}

#[wasm_bindgen]
impl UintAttribute {
    #[wasm_bindgen(constructor)]
    pub fn new(data: Vec<u32>, size: u8) -> Self {
        Self { data, size }
    }

    #[wasm_bindgen(js_name = "transferData")]
    pub fn transfer_data(&mut self) -> js_sys::Uint32Array {
        copy_u32_array(&self.data)
    }
}

impl From<UintAttribute> for navara_geometry::UintAttribute {
    fn from(val: UintAttribute) -> Self {
        navara_geometry::UintAttribute {
            data: val.data,
            size: val.size,
        }
    }
}
impl From<navara_geometry::UintAttribute> for UintAttribute {
    fn from(val: navara_geometry::UintAttribute) -> Self {
        UintAttribute {
            data: val.data,
            size: val.size,
        }
    }
}
