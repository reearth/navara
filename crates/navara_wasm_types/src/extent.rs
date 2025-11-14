use navara_core::{Angle, Radians};
use navara_math::{FloatType, Vec3};
use serde::Serialize;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
#[derive(Clone, Copy, Debug, Serialize)]
pub struct ExtentRadianF32 {
    pub west: f32,
    pub south: f32,
    pub east: f32,
    pub north: f32,
}

#[wasm_bindgen]
impl ExtentRadianF32 {
    #[wasm_bindgen(constructor)]
    pub fn new(west: f32, south: f32, east: f32, north: f32) -> Self {
        Self {
            west,
            south,
            east,
            north,
        }
    }
}

impl From<ExtentRadianF32> for navara_core::Extent<f32, Radians> {
    fn from(val: ExtentRadianF32) -> Self {
        Self {
            west: Angle::new(val.west),
            south: Angle::new(val.south),
            east: Angle::new(val.east),
            north: Angle::new(val.north),
        }
    }
}

impl<'a> From<&'a navara_core::Extent<f32, Radians>> for ExtentRadianF32 {
    fn from(val: &'a navara_core::Extent<f32, Radians>) -> Self {
        ExtentRadianF32 {
            west: val.west.val(),
            south: val.south.val(),
            east: val.east.val(),
            north: val.north.val(),
        }
    }
}

impl From<ExtentRadianF32> for navara_core::Extent<f64, Radians> {
    fn from(val: ExtentRadianF32) -> Self {
        Self {
            west: Angle::new(val.west as f64),
            south: Angle::new(val.south as f64),
            east: Angle::new(val.east as f64),
            north: Angle::new(val.north as f64),
        }
    }
}

impl<'a> From<&'a navara_core::Extent<f64, Radians>> for ExtentRadianF32 {
    fn from(val: &'a navara_core::Extent<f64, Radians>) -> Self {
        ExtentRadianF32 {
            west: val.west.val() as f32,
            south: val.south.val() as f32,
            east: val.east.val() as f32,
            north: val.north.val() as f32,
        }
    }
}

#[wasm_bindgen]
#[derive(Debug, Clone, Copy, PartialEq, Default, Serialize)]
pub struct BoundingSphere {
    pub center_x: FloatType,
    pub center_y: FloatType,
    pub center_z: FloatType,
    pub radius: FloatType,
}

#[wasm_bindgen]
impl BoundingSphere {
    #[wasm_bindgen(constructor)]
    pub fn new(
        center_x: FloatType,
        center_y: FloatType,
        center_z: FloatType,
        radius: FloatType,
    ) -> Self {
        Self {
            center_x,
            center_y,
            center_z,
            radius,
        }
    }
}

impl From<navara_core::BoundingSphere> for BoundingSphere {
    fn from(val: navara_core::BoundingSphere) -> Self {
        BoundingSphere {
            center_x: val.center.x,
            center_y: val.center.y,
            center_z: val.center.z,
            radius: val.radius,
        }
    }
}

impl From<BoundingSphere> for navara_core::BoundingSphere {
    fn from(val: BoundingSphere) -> Self {
        navara_core::BoundingSphere {
            center: Vec3::new(val.center_x, val.center_y, val.center_z),
            radius: val.radius,
        }
    }
}


#[wasm_bindgen]
#[derive(Debug, Clone, Copy, Default, Serialize)]
pub struct Aabb {
    pub center_x: FloatType,
    pub center_y: FloatType,
    pub center_z: FloatType,
    pub extent_x: FloatType,
    pub extent_y: FloatType,
    pub extent_z: FloatType,
}

#[wasm_bindgen]
impl Aabb {
    #[wasm_bindgen(constructor)]
    pub fn new(
        center_x: FloatType,
        center_y: FloatType,
        center_z: FloatType,
        extent_x: FloatType,
        extent_y: FloatType,
        extent_z: FloatType,
    ) -> Self {
        Self {
            center_x,
            center_y,
            center_z,
            extent_x,
            extent_y,
            extent_z,
        }
    }
}

impl From<navara_core::Aabb> for Aabb {
    fn from(val: navara_core::Aabb) -> Self {
        Aabb {
            center_x: val.center.x,
            center_y: val.center.y,
            center_z: val.center.z,
            extent_x: val.extents.x,
            extent_y: val.extents.y,
            extent_z: val.extents.z,
        }
    }
}

impl From<Aabb> for navara_core::Aabb {
    fn from(val: Aabb) -> Self {
        navara_core::Aabb {
            center: Vec3::new(val.center_x, val.center_y, val.center_z),
            extents: Vec3::new(val.extent_x, val.extent_y, val.extent_z),
        }
    }
}