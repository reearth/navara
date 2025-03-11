use navara_wasm_utils::ToU8;
use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

use crate::{ElevationDecoder, TextureFragment, Vec2};

#[wasm_bindgen]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PointMaterial {
    pub show: Option<bool>,
    pub size: Option<f32>,
    pub color: Option<u32>,
    pub center: Option<Vec2>,
    pub height: Option<f32>,
    pub scale_by_distance: Option<bool>,
    pub clamp_to_ground: Option<bool>,
    pub depth_test: Option<bool>,
    #[wasm_bindgen(getter_with_clone)]
    pub id_property: Option<String>,
}

impl From<PointMaterial> for navara_material::PointMaterial {
    fn from(val: PointMaterial) -> Self {
        let default = navara_material::PointMaterial::default();
        navara_material::PointMaterial {
            show: val.show.unwrap_or(true),
            size: val.size.unwrap_or(default.size),
            color: val.color.unwrap_or(default.color),
            center: val.center.unwrap_or(default.center.into()).into(),
            height: val.height.unwrap_or(default.height),
            scale_by_distance: val.scale_by_distance.unwrap_or(default.scale_by_distance),
            clamp_to_ground: val.clamp_to_ground.unwrap_or(default.clamp_to_ground),
            depth_test: val.depth_test.unwrap_or(default.depth_test),
            id_property: val.id_property.unwrap_or("".to_string()),
        }
    }
}
impl<'a> From<&'a navara_material::PointMaterial> for PointMaterial {
    fn from(value: &'a navara_material::PointMaterial) -> PointMaterial {
        PointMaterial {
            show: Some(value.show),
            size: Some(value.size),
            color: Some(value.color),
            center: Some(value.center.into()),
            height: Some(value.height),
            scale_by_distance: Some(value.scale_by_distance),
            clamp_to_ground: Some(value.clamp_to_ground),
            depth_test: Some(value.depth_test),
            id_property: Some(value.id_property.clone()),
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
    pub size: Option<f32>,
    pub color: Option<u32>,
    pub center: Option<Vec2>,
    pub height: Option<f32>,
    #[wasm_bindgen(getter_with_clone)]
    pub url: Option<String>,
    pub scale_by_distance: Option<bool>,
    pub clamp_to_ground: Option<bool>,
    pub depth_test: Option<bool>,
    #[wasm_bindgen(getter_with_clone)]
    pub id_property: Option<String>,
}

impl From<BillboardMaterial> for navara_material::BillboardMaterial {
    fn from(val: BillboardMaterial) -> Self {
        let default = navara_material::BillboardMaterial::default();
        navara_material::BillboardMaterial {
            show: val.show.unwrap_or(default.show),
            size: val.size.unwrap_or(default.size),
            color: val.color.unwrap_or(default.color),
            center: val.center.unwrap_or(default.center.into()).into(),
            height: val.height.unwrap_or(default.height),
            url: val.url.unwrap_or(default.url),
            scale_by_distance: val.scale_by_distance.unwrap_or(default.scale_by_distance),
            clamp_to_ground: val.clamp_to_ground.unwrap_or(default.clamp_to_ground),
            depth_test: val.depth_test.unwrap_or(default.depth_test),
            id_property: val.id_property.unwrap_or("".to_string()),
        }
    }
}
impl<'a> From<&'a navara_material::BillboardMaterial> for BillboardMaterial {
    fn from(value: &'a navara_material::BillboardMaterial) -> BillboardMaterial {
        BillboardMaterial {
            show: Some(value.show),
            size: Some(value.size),
            color: Some(value.color),
            center: Some(value.center.into()),
            height: Some(value.height),
            url: Some(value.url.clone()),
            scale_by_distance: Some(value.scale_by_distance),
            clamp_to_ground: Some(value.clamp_to_ground),
            depth_test: Some(value.depth_test),
            id_property: Some(value.id_property.clone()),
        }
    }
}

#[wasm_bindgen]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PolylineMaterial {
    pub show: Option<bool>,
    pub color: Option<u32>,
    pub width: Option<f32>,
    pub clamp_to_ground: Option<bool>,
    pub use_ground_normals: Option<bool>,
    pub height: Option<f32>,
    #[wasm_bindgen(getter_with_clone)]
    pub __internal__: Option<PolylineInternalMaterial>,
    #[wasm_bindgen(getter_with_clone)]
    pub id_property: Option<String>,
}

#[wasm_bindgen]
impl PolylineMaterial {
    #[wasm_bindgen(constructor)]
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        show: Option<bool>,
        color: Option<u32>,
        clamp_to_ground: Option<bool>,
        use_ground_normals: Option<bool>,
        height: Option<f32>,
        width: Option<f32>,
        __internal__: Option<PolylineInternalMaterial>,
        id_property: Option<String>,
    ) -> Self {
        Self {
            show,
            color,
            clamp_to_ground,
            use_ground_normals,
            height,
            width,
            __internal__,
            id_property,
        }
    }
}

impl From<PolylineMaterial> for navara_material::PolylineMaterial {
    fn from(val: PolylineMaterial) -> Self {
        let default = navara_material::PolylineMaterial::default();
        navara_material::PolylineMaterial {
            show: val.show.unwrap_or(true),
            color: val.color.unwrap_or(default.color),
            width: val.width.unwrap_or(default.width),
            clamp_to_ground: val.clamp_to_ground.unwrap_or(default.clamp_to_ground),
            use_ground_normals: val.use_ground_normals.unwrap_or(default.use_ground_normals),
            height: val.height.unwrap_or(default.height),
            internal: val.__internal__.map(|v| v.into()),
            id_property: val.id_property.unwrap_or("".to_string()),
        }
    }
}
impl<'a> From<&'a navara_material::PolylineMaterial> for PolylineMaterial {
    fn from(value: &'a navara_material::PolylineMaterial) -> PolylineMaterial {
        PolylineMaterial {
            show: Some(value.show),
            color: Some(value.color),
            width: Some(value.width),
            clamp_to_ground: Some(value.clamp_to_ground),
            use_ground_normals: Some(value.use_ground_normals),
            height: Some(value.height),
            __internal__: value.internal.as_ref().map(|v| v.into()),
            id_property: Some(value.id_property.clone()),
        }
    }
}

#[wasm_bindgen]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PolylineInternalMaterial {
    #[wasm_bindgen(getter_with_clone)]
    pub min_max_heights: Vec<f32>,
}

impl From<PolylineInternalMaterial> for navara_material::PolylineInternalMaterial {
    fn from(val: PolylineInternalMaterial) -> Self {
        navara_material::PolylineInternalMaterial {
            min_max_heights: val.min_max_heights,
        }
    }
}
impl From<&navara_material::PolylineInternalMaterial> for PolylineInternalMaterial {
    fn from(val: &navara_material::PolylineInternalMaterial) -> Self {
        PolylineInternalMaterial {
            min_max_heights: val.min_max_heights.clone(),
        }
    }
}

#[wasm_bindgen]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PolygonMaterial {
    pub show: Option<bool>,
    pub color: Option<u32>,
    pub clamp_to_ground: Option<bool>,
    pub use_ground_normals: Option<bool>,
    pub height: Option<f32>,
    pub extruded_height: Option<f32>,
    pub wireframe: Option<bool>,
    #[wasm_bindgen(getter_with_clone)]
    pub __internal__: Option<PolygonInternalMaterial>,
    #[wasm_bindgen(getter_with_clone)]
    pub id_property: Option<String>,
}

#[wasm_bindgen]
impl PolygonMaterial {
    #[wasm_bindgen(constructor)]
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        show: Option<bool>,
        color: Option<u32>,
        clamp_to_ground: Option<bool>,
        use_ground_normals: Option<bool>,
        height: Option<f32>,
        extruded_height: Option<f32>,
        wireframe: Option<bool>,
        __internal__: Option<PolygonInternalMaterial>,
        id_property: Option<String>,
    ) -> Self {
        Self {
            show,
            color,
            clamp_to_ground,
            use_ground_normals,
            height,
            extruded_height,
            wireframe,
            __internal__,
            id_property,
        }
    }
}

impl From<PolygonMaterial> for navara_material::PolygonMaterial {
    fn from(val: PolygonMaterial) -> Self {
        let default = navara_material::PolygonMaterial::default();
        navara_material::PolygonMaterial {
            show: val.show.unwrap_or(default.show),
            color: val.color.unwrap_or(default.color),
            clamp_to_ground: val.clamp_to_ground.unwrap_or(default.clamp_to_ground),
            use_ground_normals: val.use_ground_normals.unwrap_or(default.use_ground_normals),
            height: val.height.unwrap_or(default.height),
            extruded_height: val.extruded_height,
            wireframe: val.wireframe.unwrap_or(default.wireframe),
            internal: val.__internal__.map(|v| v.into()),
            id_property: val.id_property.unwrap_or("".to_string()),
        }
    }
}
impl<'a> From<&'a navara_material::PolygonMaterial> for PolygonMaterial {
    fn from(value: &'a navara_material::PolygonMaterial) -> PolygonMaterial {
        PolygonMaterial {
            show: Some(value.show),
            color: Some(value.color),
            clamp_to_ground: Some(value.clamp_to_ground),
            use_ground_normals: Some(value.use_ground_normals),
            height: Some(value.height),
            extruded_height: value.extruded_height,
            wireframe: Some(value.wireframe),
            __internal__: value.internal.as_ref().map(|v| v.into()),
            id_property: Some(value.id_property.clone()),
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
impl From<&navara_material::PolygonInternalMaterial> for PolygonInternalMaterial {
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
    #[wasm_bindgen(getter_with_clone)]
    pub id_property: Option<String>,
}

impl From<ModelMaterial> for navara_material::ModelMaterial {
    fn from(val: ModelMaterial) -> Self {
        let default = navara_material::ModelMaterial::default();
        navara_material::ModelMaterial {
            show: val.show.unwrap_or(default.show),
            url: val.url.unwrap_or(default.url),
            size: val.size.unwrap_or(default.size),
            height: val.height.unwrap_or(default.height),
            max_sse: val.max_sse.unwrap_or(default.max_sse),
            clamp_to_ground: val.clamp_to_ground.unwrap_or(default.clamp_to_ground),
            should_rotate_in_default: val
                .should_rotate_in_default
                .unwrap_or(default.should_rotate_in_default),
            id_property: val.id_property.unwrap_or("".to_string()),
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
            id_property: Some(value.id_property.clone()),
        }
    }
}

#[wasm_bindgen]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RasterTileMaterial {
    pub show: Option<bool>,
    pub segments: Option<usize>,
    pub color: Option<u32>,
    pub opacity: Option<f32>,
    pub max_zoom: Option<usize>,
    pub max_sse: Option<f32>,
    pub wireframe: Option<bool>,
    pub should_compute_normal_from_vertex: Option<bool>,
}

impl From<RasterTileMaterial> for navara_material::RasterTileMaterial {
    fn from(val: RasterTileMaterial) -> Self {
        let default = navara_material::RasterTileMaterial::default();
        navara_material::RasterTileMaterial {
            show: val.show.unwrap_or(default.show),
            segments: val.segments.unwrap_or(default.segments),
            color: val.color.unwrap_or(default.color),
            opacity: val.opacity.unwrap_or(default.opacity),
            max_zoom: val.max_zoom.unwrap_or(default.max_zoom),
            max_sse: val.max_sse.unwrap_or(default.max_sse),
            should_compute_normal_from_vertex: val.should_compute_normal_from_vertex,
            wireframe: val.wireframe.unwrap_or(default.wireframe),
        }
    }
}
impl<'a> From<&'a navara_material::RasterTileMaterial> for RasterTileMaterial {
    fn from(value: &'a navara_material::RasterTileMaterial) -> RasterTileMaterial {
        RasterTileMaterial {
            show: Some(value.show),
            segments: Some(value.segments),
            color: Some(value.color),
            opacity: Some(value.opacity),
            max_zoom: Some(value.max_zoom),
            max_sse: Some(value.max_sse),
            should_compute_normal_from_vertex: value.should_compute_normal_from_vertex,
            wireframe: Some(value.wireframe),
        }
    }
}

#[wasm_bindgen]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RasterTileInternalMaterial {
    #[wasm_bindgen(getter_with_clone)]
    pub shows: Vec<u8>,
    #[wasm_bindgen(getter_with_clone)]
    pub colors: Vec<u32>,
    #[wasm_bindgen(getter_with_clone)]
    pub opacities: Vec<f32>,
    texture_fragments: Option<Vec<Option<TextureFragment>>>,
    pub should_compute_normal_from_vertex: Option<bool>,
    pub wireframe: bool,
}

#[wasm_bindgen]
impl RasterTileInternalMaterial {
    pub fn texture_fragments(&self) -> Option<Vec<JsValue>> {
        self.texture_fragments.as_ref().map(|ts| {
            ts.iter()
                .map(|t| t.clone().map(|t| t.into()).unwrap_or(JsValue::null()))
                .collect()
        })
    }
}

impl<'a> From<&'a navara_material::RasterTileInternalMaterial> for RasterTileInternalMaterial {
    fn from(m: &'a navara_material::RasterTileInternalMaterial) -> Self {
        Self {
            shows: m.shows.iter().map(|s| s.to_u8()).collect(),
            colors: m.colors.clone(),
            opacities: m.opacities.clone(),
            texture_fragments: m.texture_fragments.as_ref().map(|ts| {
                ts.iter()
                    .map(|t| {
                        t.map(|t| TextureFragment {
                            ind: t.index(),
                            gen: t.generation(),
                        })
                    })
                    .collect()
            }),
            should_compute_normal_from_vertex: m.should_compute_normal_from_vertex,
            wireframe: m.wireframe,
        }
    }
}

#[wasm_bindgen]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VectorTileMaterial {
    pub show: Option<bool>,
    pub max_zoom: Option<usize>,
    pub max_sse: Option<f32>,
}

impl From<VectorTileMaterial> for navara_material::VectorTileMaterial {
    fn from(val: VectorTileMaterial) -> Self {
        let default = navara_material::VectorTileMaterial::default();
        navara_material::VectorTileMaterial {
            show: val.show.unwrap_or(default.show),
            max_zoom: val.max_zoom.unwrap_or(default.max_zoom),
            max_sse: val.max_sse.unwrap_or(default.max_sse),
        }
    }
}
impl<'a> From<&'a navara_material::VectorTileMaterial> for VectorTileMaterial {
    fn from(value: &'a navara_material::VectorTileMaterial) -> VectorTileMaterial {
        VectorTileMaterial {
            show: Some(value.show),
            max_zoom: Some(value.max_zoom),
            max_sse: Some(value.max_sse),
        }
    }
}

#[wasm_bindgen]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RasterTerrainMaterial {
    pub show: Option<bool>,
    pub segments: Option<usize>,
    pub max_zoom: Option<usize>,
    pub min_zoom: Option<usize>,
    pub wireframe: Option<bool>,
    pub elevation_decoder: Option<ElevationDecoder>,
    pub tile_size: Option<u32>,
}

impl From<RasterTerrainMaterial> for navara_material::RasterTerrainMaterial {
    fn from(val: RasterTerrainMaterial) -> Self {
        let default = navara_material::RasterTerrainMaterial::default();
        navara_material::RasterTerrainMaterial {
            show: val.show.unwrap_or(true),
            segments: val.segments.unwrap_or(default.segments),
            max_zoom: val.max_zoom.unwrap_or(default.max_zoom),
            min_zoom: val.min_zoom.unwrap_or(default.min_zoom),
            wireframe: val.wireframe.unwrap_or(default.wireframe),
            tile_size: val.tile_size.unwrap_or(default.tile_size),
            elevation_decoder: val
                .elevation_decoder
                .unwrap_or(default.elevation_decoder.into())
                .into(),
        }
    }
}

impl<'a> From<&'a navara_material::RasterTerrainMaterial> for RasterTerrainMaterial {
    fn from(value: &'a navara_material::RasterTerrainMaterial) -> RasterTerrainMaterial {
        RasterTerrainMaterial {
            show: Some(value.show),
            segments: Some(value.segments),
            max_zoom: Some(value.max_zoom),
            min_zoom: Some(value.min_zoom),
            wireframe: Some(value.wireframe),
            elevation_decoder: Some(ElevationDecoder {
                r_scaler: value.elevation_decoder.r_scaler,
                g_scaler: value.elevation_decoder.g_scaler,
                b_scaler: value.elevation_decoder.b_scaler,
                offset: value.elevation_decoder.offset,
                max_offset: value.elevation_decoder.max_offset,
                min_offset: value.elevation_decoder.min_offset,
                boundary: value.elevation_decoder.boundary,
                epsilon: value.elevation_decoder.epsilon,
            }),
            tile_size: Some(value.tile_size),
        }
    }
}
