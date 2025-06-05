use wasm_bindgen::prelude::*;

use navara_core::{CRS, WGS84_32};
use navara_math::{FloatType, Vec3};
pub use navara_wasm_types::LLE;

#[wasm_bindgen(js_name = geodeticToXyz)]
pub fn geodetic_to_ecef(lle: LLE) -> Vec<FloatType> {
    let lle_pt = Vec3::new(lle.lng, lle.lat, lle.height);

    let ecef_pt = CRS::Geographic.to_vec3(WGS84_32, lle_pt, 0.0);

    vec![ecef_pt.x, ecef_pt.y, ecef_pt.z]
}
