use wasm_bindgen::prelude::*;

use navara_core::{EllipsoidGeodesic, WGS84_32};
use navara_math::FloatType;
use navara_wasm_types::LLE;

#[wasm_bindgen(js_name = getSurfaceDistance)]
pub fn get_surface_distance(start: LLE, end: LLE) -> FloatType {
    let start_lle: navara_core::LLE<f32, navara_core::Radians> = (&start).into();
    let end_lle: navara_core::LLE<f32, navara_core::Radians> = (&end).into();

    let geodesic = EllipsoidGeodesic::new(start_lle, end_lle, &WGS84_32);
    geodesic.distance
}

#[wasm_bindgen(js_name = interpolateGeodeticPoints)]
pub fn interpolate_geodetic_points(start: LLE, end: LLE, num_points: u32) -> Vec<LLE> {
    let start_lle: navara_core::LLE<f32, navara_core::Radians> = (&start).into();
    let end_lle: navara_core::LLE<f32, navara_core::Radians> = (&end).into();

    let geodesic = EllipsoidGeodesic::new(start_lle, end_lle, &WGS84_32);
    let total_distance = geodesic.distance;

    let mut points = Vec::new();

    for i in 0..num_points {
        let fraction = if num_points == 1 {
            0.0
        } else {
            i as f32 / (num_points - 1) as f32
        };
        let distance = fraction * total_distance;

        let interpolated_lle = geodesic.interpolate_distance(&WGS84_32, distance);

        points.push(interpolated_lle.into());
    }

    points
}
