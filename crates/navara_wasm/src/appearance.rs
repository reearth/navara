use crate::Vec2;
use navara_math::FloatType;
use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PointMaterial {
    pub show: bool,
    pub size: FloatType,
    pub color: u32,
    pub center: Vec2,
    pub height: FloatType,
    #[wasm_bindgen(getter_with_clone)]
    pub scale_by_distance: NearFar,
    pub clamp_to_ground: bool,
    pub depth_test: bool,
}

impl From<PointMaterial> for navara_layer::PointMaterial {
    fn from(val: PointMaterial) -> Self {
        navara_layer::PointMaterial {
            show: val.show,
            size: val.size,
            color: val.color,
            center: val.center.into(),
            height: val.height,
            scale_by_distance: (val.scale_by_distance.near, val.scale_by_distance.far),
            clamp_to_ground: val.clamp_to_ground,
            depth_test: val.depth_test,
        }
    }
}
impl<'a> From<&'a navara_layer::PointMaterial> for PointMaterial {
    fn from(value: &'a navara_layer::PointMaterial) -> PointMaterial {
        PointMaterial {
            show: value.show,
            size: value.size,
            color: value.color,
            center: value.center.into(),
            height: value.height,
            scale_by_distance: NearFar {
                near: value.scale_by_distance.0,
                far: value.scale_by_distance.1,
            },
            clamp_to_ground: value.clamp_to_ground,
            depth_test: value.depth_test,
        }
    }
}

#[wasm_bindgen]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NearFar {
    pub near: FloatType,
    pub far: FloatType,
}

#[wasm_bindgen]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BillboardMaterial {
    pub show: bool,
    pub size: FloatType,
    pub color: u32,
    pub center: Vec2,
    pub height: FloatType,
    #[wasm_bindgen(getter_with_clone)]
    pub url: String,
    #[wasm_bindgen(getter_with_clone)]
    pub scale_by_distance: NearFar,
    pub clamp_to_ground: bool,
    pub depth_test: bool,
}

impl From<BillboardMaterial> for navara_layer::BillboardMaterial {
    fn from(val: BillboardMaterial) -> Self {
        navara_layer::BillboardMaterial {
            show: val.show,
            size: val.size,
            color: val.color,
            center: val.center.into(),
            height: val.height,
            url: val.url,
            scale_by_distance: (val.scale_by_distance.near, val.scale_by_distance.far),
            clamp_to_ground: val.clamp_to_ground,
            depth_test: val.depth_test,
        }
    }
}
impl<'a> From<&'a navara_layer::BillboardMaterial> for BillboardMaterial {
    fn from(value: &'a navara_layer::BillboardMaterial) -> BillboardMaterial {
        BillboardMaterial {
            show: value.show,
            size: value.size,
            color: value.color,
            center: value.center.into(),
            height: value.height,
            url: value.url.clone(),
            scale_by_distance: NearFar {
                near: value.scale_by_distance.0,
                far: value.scale_by_distance.1,
            },
            clamp_to_ground: value.clamp_to_ground,
            depth_test: value.depth_test,
        }
    }
}

#[wasm_bindgen]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PolylineMaterial {
    pub show: bool,
}

impl From<PolylineMaterial> for navara_layer::PolylineMaterial {
    fn from(val: PolylineMaterial) -> Self {
        navara_layer::PolylineMaterial { show: val.show }
    }
}
impl<'a> From<&'a navara_layer::PolylineMaterial> for PolylineMaterial {
    fn from(value: &'a navara_layer::PolylineMaterial) -> PolylineMaterial {
        PolylineMaterial { show: value.show }
    }
}

#[wasm_bindgen]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PolygonMaterial {
    pub show: bool,
}

impl From<PolygonMaterial> for navara_layer::PolygonMaterial {
    fn from(val: PolygonMaterial) -> Self {
        navara_layer::PolygonMaterial { show: val.show }
    }
}
impl<'a> From<&'a navara_layer::PolygonMaterial> for PolygonMaterial {
    fn from(value: &'a navara_layer::PolygonMaterial) -> PolygonMaterial {
        PolygonMaterial { show: value.show }
    }
}

#[wasm_bindgen]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelMaterial {
    pub show: bool,
    #[wasm_bindgen(getter_with_clone)]
    pub url: String,
}

impl From<ModelMaterial> for navara_layer::ModelMaterial {
    fn from(val: ModelMaterial) -> Self {
        navara_layer::ModelMaterial {
            show: val.show,
            url: val.url,
        }
    }
}
impl<'a> From<&'a navara_layer::ModelMaterial> for ModelMaterial {
    fn from(value: &'a navara_layer::ModelMaterial) -> ModelMaterial {
        ModelMaterial {
            show: value.show,
            url: value.url.clone(),
        }
    }
}
