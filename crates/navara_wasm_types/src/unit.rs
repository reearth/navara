use navara_math::FloatType;
use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct Vec2 {
    pub x: FloatType,
    pub y: FloatType,
}

impl From<navara_math::Vec2> for Vec2 {
    fn from(v: navara_math::Vec2) -> Self {
        Self { x: v.x, y: v.y }
    }
}

impl From<Vec2> for navara_math::Vec2 {
    fn from(v: Vec2) -> Self {
        Self { x: v.x, y: v.y }
    }
}

#[wasm_bindgen]
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct Vec3 {
    pub x: FloatType,
    pub y: FloatType,
    pub z: FloatType,
}

#[wasm_bindgen]
impl Vec3 {
    #[wasm_bindgen(constructor)]
    pub fn new(x: FloatType, y: FloatType, z: FloatType) -> Self {
        Self { x, y, z }
    }
}

impl From<navara_math::Vec3> for Vec3 {
    fn from(v: navara_math::Vec3) -> Self {
        Self {
            x: v.x,
            y: v.y,
            z: v.z,
        }
    }
}

impl From<Vec3> for navara_math::Vec3 {
    fn from(v: Vec3) -> Self {
        Self {
            x: v.x,
            y: v.y,
            z: v.z,
        }
    }
}
