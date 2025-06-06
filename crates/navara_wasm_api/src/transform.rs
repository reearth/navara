use wasm_bindgen::prelude::*;

use navara_core::{CRS, WGS84_32};
use navara_math::Vec3;
use navara_wasm_types::{Vec3 as Vec3Wasm, LLE};

#[wasm_bindgen(js_name = geodeticToXyz)]
pub fn geodetic_to_ecef(lle: LLE) -> Vec3Wasm {
    let lle_pt = Vec3::new(lle.lng, lle.lat, lle.height);

    let ecef_pt = CRS::Geographic.to_vec3(WGS84_32, lle_pt, 0.0);

    Vec3Wasm {
        x: ecef_pt.x,
        y: ecef_pt.y,
        z: ecef_pt.z,
    }
}
