use navara_math::FloatType;
use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::wasm_bindgen;

#[wasm_bindgen]
#[derive(Debug, Clone, PartialEq, Default, Copy, Serialize, Deserialize)]
pub struct ElevationDecoder {
    pub r_scaler: FloatType,
    pub g_scaler: FloatType,
    pub b_scaler: FloatType,
    pub offset: FloatType,
    pub max_offset: FloatType,
    pub min_offset: FloatType,
    pub boundary: FloatType,
    pub epsilon: FloatType,
}

#[allow(clippy::too_many_arguments)]
#[wasm_bindgen]
impl ElevationDecoder {
    #[wasm_bindgen(constructor)]
    pub fn new(
        r_scaler: FloatType,
        g_scaler: FloatType,
        b_scaler: FloatType,
        offset: FloatType,
        max_offset: FloatType,
        min_offset: FloatType,
        boundary: FloatType,
        epsilon: FloatType,
    ) -> Self {
        Self {
            r_scaler,
            g_scaler,
            b_scaler,
            offset,
            max_offset,
            min_offset,
            boundary,
            epsilon,
        }
    }

    #[wasm_bindgen(js_name = japanGSI)]
    pub fn japan_gsi() -> Self {
        navara_core::JAPAN_GSI_ELEVATION_DECODER.into()
    }

    pub fn mapbox() -> Self {
        navara_core::MAPBOX_ELEVATION_DECODER.into()
    }

    pub fn terrarium() -> Self {
        navara_core::TERRARIUM_ELEVATION_DECODER.into()
    }
}

impl From<ElevationDecoder> for navara_core::ElevationDecoder {
    fn from(d: ElevationDecoder) -> Self {
        navara_core::ElevationDecoder {
            r_scaler: d.r_scaler,
            g_scaler: d.g_scaler,
            b_scaler: d.b_scaler,
            offset: d.offset,
            max_offset: d.max_offset,
            min_offset: d.min_offset,
            boundary: d.boundary,
            epsilon: d.epsilon,
        }
    }
}

impl From<navara_core::ElevationDecoder> for ElevationDecoder {
    fn from(d: navara_core::ElevationDecoder) -> Self {
        ElevationDecoder {
            r_scaler: d.r_scaler,
            g_scaler: d.g_scaler,
            b_scaler: d.b_scaler,
            offset: d.offset,
            max_offset: d.max_offset,
            min_offset: d.min_offset,
            boundary: d.boundary,
            epsilon: d.epsilon,
        }
    }
}
