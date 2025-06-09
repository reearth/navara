use wasm_bindgen::prelude::*;

use navara_core::{CRS, WGS84_32};
use navara_math::{FloatType, Vec3};
use navara_wasm_types::{Vec3 as Vec3Wasm, LLE};

#[wasm_bindgen(js_name = geodeticToXyz)]
pub fn geodetic_to_ecef(lle: LLE) -> Vec3Wasm {
    let lle_pt = Vec3::new(lle.lng.to_degrees(), lle.lat.to_degrees(), lle.height);

    let ecef_pt = CRS::Geographic.to_vec3(WGS84_32, lle_pt, 0.0);

    Vec3Wasm {
        x: ecef_pt.x,
        y: ecef_pt.y,
        z: ecef_pt.z,
    }
}

#[wasm_bindgen(js_name = xyzToGeodetic)]
pub fn ecef_to_geodetic(vec3: Vec3Wasm) -> LLE {
    let lle = CRS::Geocentric.to_lle(WGS84_32, vec3.into(), 0.0);
    lle.into()
}

#[wasm_bindgen(js_name = angleToRadian)]
pub fn angle_to_radian(degree: FloatType) -> FloatType {
    degree.to_radians()
}

#[wasm_bindgen(js_name = angleToDegree)]
pub fn angle_to_degree(radian: FloatType) -> FloatType {
    radian.to_degrees()
}
