use navara_math::FloatType;
use wasm_bindgen::prelude::*;

use crate::Vec3;

#[wasm_bindgen]
pub struct Ray {
    pub origin: Vec3,
    pub direction: Vec3,
}

#[wasm_bindgen]
impl Ray {
    #[wasm_bindgen(constructor)]
    pub fn new(origin: Vec3, direction: Vec3) -> Self {
        Self { origin, direction }
    }

    #[wasm_bindgen(js_name = getPoint)]
    pub fn get_point(&self, t: FloatType) -> Vec3 {
        let origin: navara_math::Vec3 = self.origin.into();
        let direction: navara_math::Vec3 = self.direction.into();
        let result = origin + direction * t;
        Vec3::new(result.x, result.y, result.z)
    }
}

impl From<&Ray> for navara_core::Ray {
    fn from(val: &Ray) -> Self {
        navara_core::Ray {
            origin: val.origin.into(),
            direction: val.direction.into(),
        }
    }
}

impl From<navara_core::Ray> for Ray {
    fn from(val: navara_core::Ray) -> Self {
        Ray {
            origin: Vec3::new(val.origin.x, val.origin.y, val.origin.z),
            direction: Vec3::new(val.direction.x, val.direction.y, val.direction.z),
        }
    }
}
