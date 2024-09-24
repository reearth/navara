use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

use crate::Vec2;

#[wasm_bindgen]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PointMaterial {
    pub show: Option<bool>,
    pub size: f32,
    pub color: u32,
    pub center: Vec2,
    pub height: f32,
    #[wasm_bindgen(getter_with_clone)]
    pub scale_by_distance: NearFar,
    pub clamp_to_ground: bool,
    pub depth_test: bool,
}

impl From<PointMaterial> for navara_layer::PointMaterial {
    fn from(val: PointMaterial) -> Self {
        navara_layer::PointMaterial {
            show: val.show.unwrap_or(true),
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
            show: Some(value.show),
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
    pub near: f32,
    pub far: f32,
}

#[wasm_bindgen]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BillboardMaterial {
    pub show: Option<bool>,
    pub size: f32,
    pub color: u32,
    pub center: Vec2,
    pub height: f32,
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
            show: val.show.unwrap_or(true),
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
            show: Some(value.show),
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
    pub show: Option<bool>,
    pub color: u32,
    pub width: f32,
    pub clamp_to_ground: bool,
    pub height: f32,
}

impl From<PolylineMaterial> for navara_layer::PolylineMaterial {
    fn from(val: PolylineMaterial) -> Self {
        navara_layer::PolylineMaterial {
            show: val.show.unwrap_or(true),
            color: val.color,
            width: val.width,
            clamp_to_ground: val.clamp_to_ground,
            height: val.height,
        }
    }
}
impl<'a> From<&'a navara_layer::PolylineMaterial> for PolylineMaterial {
    fn from(value: &'a navara_layer::PolylineMaterial) -> PolylineMaterial {
        PolylineMaterial {
            show: Some(value.show),
            color: value.color,
            width: value.width,
            clamp_to_ground: value.clamp_to_ground,
            height: value.height,
        }
    }
}

#[wasm_bindgen]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PolygonMaterial {
    pub show: Option<bool>,
}

impl From<PolygonMaterial> for navara_layer::PolygonMaterial {
    fn from(val: PolygonMaterial) -> Self {
        navara_layer::PolygonMaterial {
            show: val.show.unwrap_or(true),
        }
    }
}
impl<'a> From<&'a navara_layer::PolygonMaterial> for PolygonMaterial {
    fn from(value: &'a navara_layer::PolygonMaterial) -> PolygonMaterial {
        PolygonMaterial {
            show: Some(value.show),
        }
    }
}

#[wasm_bindgen]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelMaterial {
    pub show: Option<bool>,
    #[wasm_bindgen(getter_with_clone)]
    pub url: String,
    pub size: f32,
    pub height: f32,
    pub clamp_to_ground: bool,
}

impl From<ModelMaterial> for navara_layer::ModelMaterial {
    fn from(val: ModelMaterial) -> Self {
        navara_layer::ModelMaterial {
            show: val.show.unwrap_or(true),
            url: val.url,
            size: val.size,
            height: val.height,
            clamp_to_ground: val.clamp_to_ground,
        }
    }
}
impl<'a> From<&'a navara_layer::ModelMaterial> for ModelMaterial {
    fn from(value: &'a navara_layer::ModelMaterial) -> ModelMaterial {
        ModelMaterial {
            show: Some(value.show),
            url: value.url.clone(),
            size: value.size,
            height: value.height,
            clamp_to_ground: value.clamp_to_ground,
        }
    }
}
