use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

use crate::Vec2;

#[wasm_bindgen]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PointMaterial {
    pub show: bool,
    pub size: f32,
    pub color: u32,
    pub center: Vec2,
    pub height: f32,
    #[wasm_bindgen(getter_with_clone)]
    pub scale_by_distance: NearFar,
}

impl Into<navara_layer::PointMaterial> for PointMaterial {
    fn into(self) -> navara_layer::PointMaterial {
        navara_layer::PointMaterial {
            show: self.show,
            size: self.size,
            color: self.color,
            center: self.center.into(),
            height: self.height,
            scale_by_distance: (self.scale_by_distance.near, self.scale_by_distance.far),
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
    pub show: bool,
    pub size: f32,
    pub color: u32,
    pub center: Vec2,
    pub height: f32,
    #[wasm_bindgen(getter_with_clone)]
    pub url: String,
    #[wasm_bindgen(getter_with_clone)]
    pub scale_by_distance: NearFar,
}

impl Into<navara_layer::BillboardMaterial> for BillboardMaterial {
    fn into(self) -> navara_layer::BillboardMaterial {
        navara_layer::BillboardMaterial {
            show: self.show,
            size: self.size,
            color: self.color,
            center: self.center.into(),
            height: self.height,
            url: self.url,
            scale_by_distance: (self.scale_by_distance.near, self.scale_by_distance.far),
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
        }
    }
}

#[wasm_bindgen]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PolylineMaterial {
    pub show: bool,
}

impl Into<navara_layer::PolylineMaterial> for PolylineMaterial {
    fn into(self) -> navara_layer::PolylineMaterial {
        navara_layer::PolylineMaterial { show: self.show }
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

impl Into<navara_layer::PolygonMaterial> for PolygonMaterial {
    fn into(self) -> navara_layer::PolygonMaterial {
        navara_layer::PolygonMaterial { show: self.show }
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

impl Into<navara_layer::ModelMaterial> for ModelMaterial {
    fn into(self) -> navara_layer::ModelMaterial {
        navara_layer::ModelMaterial {
            show: self.show,
            url: self.url,
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
