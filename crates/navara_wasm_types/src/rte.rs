use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

use crate::Vec3;

#[wasm_bindgen]
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct EncodedVec3 {
    pub high: Vec3,
    pub low: Vec3,
}

#[wasm_bindgen]
impl EncodedVec3 {
    #[wasm_bindgen(constructor)]
    pub fn new(high: Vec3, low: Vec3) -> Self {
        Self { high, low }
    }
}

impl From<navara_core::EncodedVec3> for EncodedVec3 {
    fn from(v: navara_core::EncodedVec3) -> Self {
        Self {
            high: v.high.into(),
            low: v.low.into(),
        }
    }
}

impl From<EncodedVec3> for navara_core::EncodedVec3 {
    fn from(v: EncodedVec3) -> Self {
        Self {
            high: v.high.into(),
            low: v.low.into(),
        }
    }
}
