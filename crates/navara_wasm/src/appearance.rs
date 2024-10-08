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

impl From<PointMaterial> for navara_material::PointMaterial {
    fn from(val: PointMaterial) -> Self {
        navara_material::PointMaterial {
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
impl<'a> From<&'a navara_material::PointMaterial> for PointMaterial {
    fn from(value: &'a navara_material::PointMaterial) -> PointMaterial {
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

impl From<BillboardMaterial> for navara_material::BillboardMaterial {
    fn from(val: BillboardMaterial) -> Self {
        navara_material::BillboardMaterial {
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
impl<'a> From<&'a navara_material::BillboardMaterial> for BillboardMaterial {
    fn from(value: &'a navara_material::BillboardMaterial) -> BillboardMaterial {
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

impl From<PolylineMaterial> for navara_material::PolylineMaterial {
    fn from(val: PolylineMaterial) -> Self {
        navara_material::PolylineMaterial {
            show: val.show.unwrap_or(true),
            color: val.color,
            width: val.width,
            clamp_to_ground: val.clamp_to_ground,
            height: val.height,
        }
    }
}
impl<'a> From<&'a navara_material::PolylineMaterial> for PolylineMaterial {
    fn from(value: &'a navara_material::PolylineMaterial) -> PolylineMaterial {
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
    pub color: u32,
    pub clamp_to_ground: Option<bool>,
    pub height: Option<f32>,
    pub extruded_height: Option<f32>,
    pub wireframe: Option<bool>,
}

impl From<PolygonMaterial> for navara_material::PolygonMaterial {
    fn from(val: PolygonMaterial) -> Self {
        navara_material::PolygonMaterial {
            show: val.show.unwrap_or(true),
            color: val.color,
            clamp_to_ground: val.clamp_to_ground.unwrap_or(true),
            height: val.height.unwrap_or(0.),
            extruded_height: val.extruded_height,
            wireframe: val.wireframe.unwrap_or(false),
        }
    }
}
impl<'a> From<&'a navara_material::PolygonMaterial> for PolygonMaterial {
    fn from(value: &'a navara_material::PolygonMaterial) -> PolygonMaterial {
        PolygonMaterial {
            show: Some(value.show),
            color: value.color,
            clamp_to_ground: Some(value.clamp_to_ground),
            height: Some(value.height),
            extruded_height: value.extruded_height,
            wireframe: Some(value.wireframe),
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

impl From<ModelMaterial> for navara_material::ModelMaterial {
    fn from(val: ModelMaterial) -> Self {
        navara_material::ModelMaterial {
            show: val.show.unwrap_or(true),
            url: val.url,
            size: val.size,
            height: val.height,
            clamp_to_ground: val.clamp_to_ground,
        }
    }
}
impl<'a> From<&'a navara_material::ModelMaterial> for ModelMaterial {
    fn from(value: &'a navara_material::ModelMaterial) -> ModelMaterial {
        ModelMaterial {
            show: Some(value.show),
            url: value.url.clone(),
            size: value.size,
            height: value.height,
            clamp_to_ground: value.clamp_to_ground,
        }
    }
}
