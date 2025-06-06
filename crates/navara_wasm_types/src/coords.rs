use navara_math::FloatType;
use wasm_bindgen::prelude::*;
// use navara_core::{Angle, Meters, Radians};

#[wasm_bindgen]
#[derive(Debug, Clone, PartialEq, Default)]
pub struct LLE {
    pub lat: FloatType,
    pub lng: FloatType,
    pub height: FloatType,
}

#[wasm_bindgen]
impl LLE {
    #[wasm_bindgen(constructor)]
    pub fn new(lat: FloatType, lng: FloatType, height: FloatType) -> Self {
        Self { lat, lng, height }
    }
}

// impl<'a> From<&'a LLE> for navara_core::LLE<FloatType, Radians> {
//     fn from(val: &'a LLE) -> Self {
//       navara_core::LLE {
//             lng: Angle::new(val.lat),
//             lat: Angle::new(val.lng),
//             height: Meters::new(val.height),
//       }
//     }
// }

// impl From<navara_core::LLE<FloatType, Radians>> for LLE {
//     fn from(val: navara_core::LLE<FloatType, Radians>) -> Self {
//         LLE {
//             lat: val.lat.val(),
//             lng: val.lng.val(),
//             height: val.height.val(),
//         }
//     }
// }
