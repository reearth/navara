use wasm_bindgen::prelude::*;

use navara_math::FloatType;

use crate::LLE;

#[wasm_bindgen]
pub struct EllipsoidGeodesic {
    #[wasm_bindgen(getter_with_clone)]
    pub start: LLE,
    #[wasm_bindgen(getter_with_clone)]
    pub end: LLE,
    pub distance: FloatType,
    pub start_heading: FloatType,
    pub end_heading: FloatType,
    constants: navara_core::VincentyDirectFormulaConstants,
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
            constants: inner.constants,
        }
    }

    fn inner(&self) -> navara_core::EllipsoidGeodesic {
        navara_core::EllipsoidGeodesic::from(
            (&self.start).into(),
            (&self.end).into(),
            self.distance,
            self.start_heading,
            self.end_heading,
            self.constants.clone(),
        )
    }

    #[wasm_bindgen(js_name = "interpolateGeodeticPoints")]
    pub fn interpolate_geodetic_points(&self, granularity: Option<f32>) -> Vec<LLE> {
        let granularity = granularity.unwrap_or(9999.0);

        if granularity == 0.0 || self.distance < granularity {
            return vec![self.start.clone(), self.end.clone()];
        }

        let ellipsoid_line = self.inner();

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

    #[wasm_bindgen(js_name = "interpolateDistance")]
    pub fn interpolate_distance(&self, distance: f32) -> LLE {
        let inner = self.inner();
        inner
            .interpolate_distance(&navara_core::WGS84_32, distance)
            .into()
    }
}
