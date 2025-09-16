use wasm_bindgen::prelude::*;

use navara_core::WGS84_32;

#[wasm_bindgen(js_name = getWGS84SemiMajorAxis)]
pub fn get_wgs84_semi_major_axis() -> f32 {
    WGS84_32.semi_major_axis()
}

#[wasm_bindgen(js_name = getWGS84SemiMinorAxis)]
pub fn get_wgs84_semi_minor_axis() -> f32 {
    WGS84_32.semi_minor_axis()
}

#[wasm_bindgen(js_name = getWGS84EccentricitySquared)]
pub fn get_wgs84_eccentricity_squared() -> f32 {
    WGS84_32.eccentricity_squared()
}

#[wasm_bindgen(js_name = getWGS84Flattening)]
pub fn get_wgs84_flattening() -> f32 {
    WGS84_32.flattening()
}

#[wasm_bindgen(js_name = getWGS84Eccentricity)]
pub fn get_wgs84_eccentricity() -> f32 {
    WGS84_32.eccentricity()
}
