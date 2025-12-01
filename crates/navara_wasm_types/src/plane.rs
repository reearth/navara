use navara_math::{Dir3, FloatType};
use wasm_bindgen::prelude::*;

use crate::Vec3;

#[wasm_bindgen]
#[derive(Debug, Clone)]
pub struct Plane {
    pub normal: Vec3,
    pub distance: FloatType,
}

impl From<&Plane> for navara_core::Plane {
    fn from(val: &Plane) -> Self {
        let vec3: navara_math::Vec3 = val.normal.into();
        navara_core::Plane {
            normal: Dir3::new_unchecked(vec3.normalize().as_vec3a()),
            distance: val.distance,
        }
    }
}

impl From<navara_core::Plane> for Plane {
    fn from(val: navara_core::Plane) -> Self {
        let vec3 = val.normal.as_dvec3();
        Plane {
            normal: Vec3::new(vec3.x, vec3.y, vec3.z),
            distance: val.distance,
        }
    }
}
