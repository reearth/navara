use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

use crate::{ElevationDecoder, Vec2};

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
    #[wasm_bindgen(getter_with_clone)]
    pub __internal__: Option<PolygonInternalMaterial>,
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
            internal: val.__internal__.map(|v| v.into()),
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
            __internal__: value.internal.as_ref().map(|v| v.into()),
        }
    }
}

#[wasm_bindgen]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PolygonInternalMaterial {
    #[wasm_bindgen(getter_with_clone)]
    pub min_max_heights: Vec<f32>,
}

impl From<PolygonInternalMaterial> for navara_material::PolygonInternalMaterial {
    fn from(val: PolygonInternalMaterial) -> Self {
        navara_material::PolygonInternalMaterial {
            min_max_heights: val.min_max_heights,
        }
    }
}
impl<'a> From<&'a navara_material::PolygonInternalMaterial> for PolygonInternalMaterial {
    fn from(val: &navara_material::PolygonInternalMaterial) -> Self {
        PolygonInternalMaterial {
            min_max_heights: val.min_max_heights.clone(),
        }
    }
}

#[wasm_bindgen]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelMaterial {
    pub show: Option<bool>,
    #[wasm_bindgen(getter_with_clone)]
    pub url: Option<String>,
    pub size: Option<f32>,
    pub height: Option<f32>,
    pub max_sse: Option<f32>,
    pub clamp_to_ground: Option<bool>,
    pub should_rotate_in_default: Option<bool>,
}

impl From<ModelMaterial> for navara_material::ModelMaterial {
    fn from(val: ModelMaterial) -> Self {
        navara_material::ModelMaterial {
            show: val.show.unwrap_or(true),
            url: val.url.unwrap_or("".to_string()),
            size: val.size.unwrap_or(1.),
            height: val.height.unwrap_or(0.),
            max_sse: val.max_sse.unwrap_or(2.),
            clamp_to_ground: val.clamp_to_ground.unwrap_or(true),
            should_rotate_in_default: val.should_rotate_in_default.unwrap_or(true),
        }
    }
}
impl<'a> From<&'a navara_material::ModelMaterial> for ModelMaterial {
    fn from(value: &'a navara_material::ModelMaterial) -> ModelMaterial {
        ModelMaterial {
            show: Some(value.show),
            url: Some(value.url.clone()),
            size: Some(value.size),
            height: Some(value.height),
            max_sse: Some(value.max_sse),
            clamp_to_ground: Some(value.clamp_to_ground),
            should_rotate_in_default: Some(value.should_rotate_in_default),
        }
    }
}

#[wasm_bindgen]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RasterTileMaterial {
    pub show: Option<bool>,
    pub segments: usize,
    pub color: u32,
    pub max_z: usize,
    pub max_sse: f32,
    pub wireframe: Option<bool>,
}

impl From<RasterTileMaterial> for navara_material::RasterTileMaterial {
    fn from(val: RasterTileMaterial) -> Self {
        navara_material::RasterTileMaterial {
            show: val.show.unwrap_or(true),
            segments: val.segments,
            color: val.color,
            max_z: val.max_z,
            max_sse: val.max_sse,
            wireframe: val.wireframe.unwrap_or(false),
        }
    }
}
impl<'a> From<&'a navara_material::RasterTileMaterial> for RasterTileMaterial {
    fn from(value: &'a navara_material::RasterTileMaterial) -> RasterTileMaterial {
        RasterTileMaterial {
            show: Some(value.show),
            segments: value.segments,
            color: value.color,
            max_z: value.max_z,
            max_sse: value.max_sse,
            wireframe: Some(value.wireframe),
        }
    }
}

#[wasm_bindgen]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RasterTerrainMaterial {
    pub show: Option<bool>,
    pub segments: usize,
    pub max_z: usize,
    pub min_z: usize,
    pub wireframe: Option<bool>,
    pub elevation_decoder: ElevationDecoder,
    pub tile_size: Option<u32>,
}

impl From<RasterTerrainMaterial> for navara_material::RasterTerrainMaterial {
    fn from(val: RasterTerrainMaterial) -> Self {
        navara_material::RasterTerrainMaterial {
            show: val.show.unwrap_or(true),
            segments: val.segments,
            max_z: val.max_z,
            min_z: val.min_z,
            wireframe: val.wireframe.unwrap_or(false),
            tile_size: val.tile_size.unwrap_or(256),
            elevation_decoder: val.elevation_decoder.into(),
        }
    }
}

impl<'a> From<&'a navara_material::RasterTerrainMaterial> for RasterTerrainMaterial {
    fn from(value: &'a navara_material::RasterTerrainMaterial) -> RasterTerrainMaterial {
        RasterTerrainMaterial {
            show: Some(value.show),
            segments: value.segments,
            max_z: value.max_z,
            min_z: value.min_z,
            wireframe: Some(value.wireframe),
            elevation_decoder: ElevationDecoder {
                r_scaler: value.elevation_decoder.r_scaler,
                g_scaler: value.elevation_decoder.g_scaler,
                b_scaler: value.elevation_decoder.b_scaler,
                offset: value.elevation_decoder.offset,
                max_offset: value.elevation_decoder.max_offset,
                min_offset: value.elevation_decoder.min_offset,
                boundary: value.elevation_decoder.boundary,
                epsilon: value.elevation_decoder.epsilon,
            },
            tile_size: Some(value.tile_size),
        }
    }
}
