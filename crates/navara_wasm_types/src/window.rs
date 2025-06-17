use navara_math::FloatType;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct Window {
    pub width: FloatType,
    pub height: FloatType,
    pub pixel_ratio: FloatType,
}

#[wasm_bindgen]
impl Window {
    #[wasm_bindgen(constructor)]
    pub fn new(width: FloatType, height: FloatType, pixel_ratio: FloatType) -> Self {
        Self {
            width,
            height,
            pixel_ratio,
        }
    }
}

impl<'a> From<&'a Window> for navara_window::Window {
    fn from(t: &'a Window) -> Self {
        navara_window::Window {
            width: t.width,
            height: t.height,
            pixel_ratio: t.pixel_ratio,
        }
    }
}
