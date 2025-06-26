use wasm_bindgen::prelude::*;

use navara_math::FloatType;

use crate::LLE;

#[wasm_bindgen]
#[derive(Debug)]
pub struct EllipsoidGeodesic {
    #[wasm_bindgen(getter_with_clone)]
    pub start: LLE,
    #[wasm_bindgen(getter_with_clone)]
    pub end: LLE,
    pub distance: FloatType,
    pub start_heading: FloatType,
    pub end_heading: FloatType,
}

#[wasm_bindgen]
impl EllipsoidGeodesic {
    #[wasm_bindgen(constructor)]
    pub fn new(start: LLE, end: LLE) -> EllipsoidGeodesic {
        let start_lle: navara_core::LLE<f32, navara_core::Radians> = (&start).into();
        let end_lle: navara_core::LLE<f32, navara_core::Radians> = (&end).into();

        let inner = navara_core::EllipsoidGeodesic::new(start_lle, end_lle, &navara_core::WGS84_32);

        EllipsoidGeodesic {
            start,
            end,
            distance: inner.distance,
            start_heading: inner.start_heading,
            end_heading: inner.end_heading,
        }
    }

    #[wasm_bindgen(js_name = "interpolateGeodeticPoints")]
    pub fn interpolate_geodetic_points(&self, granularity: f32) -> Vec<LLE> {
        if granularity == 0.0 {
            return vec![self.start.clone(), self.end.clone()];
        }

        if self.distance < granularity {
            return vec![self.start.clone(), self.end.clone()];
        }

        let start_lle: navara_core::LLE<f32, navara_core::Radians> = (&self.start).into();
        let end_lle: navara_core::LLE<f32, navara_core::Radians> = (&self.end).into();

        let ellipsoid_line =
            navara_core::EllipsoidGeodesic::new(start_lle, end_lle, &navara_core::WGS84_32);

        let segments = (self.distance / granularity).ceil() as usize;
        let interpoint_distance = self.distance / segments as f32;
        let mut distance_from_start = interpoint_distance;
        let points_to_add = segments - 1;

        let mut result = vec![self.start.clone()];

        for _ in 0..points_to_add {
            let interpolated_cartographic =
                ellipsoid_line.interpolate_distance(&navara_core::WGS84_32, distance_from_start);
            result.push(interpolated_cartographic.into());
            distance_from_start += interpoint_distance;
        }

        result.push(self.end.clone());
        result
    }
}
