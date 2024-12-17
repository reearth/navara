use navara_core::{Angle, Radians};
use serde::Serialize;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
#[derive(Clone, Debug, Serialize)]
pub struct ExtentRadianF32 {
    pub west: f32,
    pub south: f32,
    pub east: f32,
    pub north: f32,
}

#[wasm_bindgen]
impl ExtentRadianF32 {
    #[wasm_bindgen(constructor)]
    pub fn new(west: f32, south: f32, east: f32, north: f32) -> Self {
        Self {
            west,
            south,
            east,
            north,
        }
    }
}

impl From<ExtentRadianF32> for navara_core::Extent<f32, Radians> {
    fn from(val: ExtentRadianF32) -> Self {
        Self {
            west: Angle::new(val.west),
            south: Angle::new(val.south),
            east: Angle::new(val.east),
            north: Angle::new(val.north),
        }
    }
}

impl<'a> From<&'a navara_core::Extent<f32, Radians>> for ExtentRadianF32 {
    fn from(val: &'a navara_core::Extent<f32, Radians>) -> Self {
        ExtentRadianF32 {
            west: val.west.val(),
            south: val.south.val(),
            east: val.east.val(),
            north: val.north.val(),
        }
    }
}
