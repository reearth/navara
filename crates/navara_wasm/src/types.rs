use gloo_utils::format::JsValueSerdeExt;
use navara_core::CRS;
use navara_layer::{GeoJsonLayer, TerrainDataType, TerrainLayer, TilesLayer};
use navara_material::Appearance;
use navara_math::FloatType;
use navara_parser::geojson::GeoJson;
use serde::Deserialize;
use wasm_bindgen::prelude::*;

use crate::appearance::{
    BillboardMaterial, ModelMaterial, PointMaterial, PolygonMaterial, PolylineMaterial,
};

#[wasm_bindgen]
#[derive(Debug, Clone, Deserialize)]
pub struct TileLayerDescription {
    #[wasm_bindgen(getter_with_clone)]
    pub r#type: String,
    #[wasm_bindgen(getter_with_clone)]
    pub url: String,
    pub segments: usize,
    pub color: u32,
    pub max_sse: Option<FloatType>,
    pub max_z: usize,
    pub wireframe: bool,
}

#[wasm_bindgen]
#[derive(Debug, Clone, Deserialize)]
pub struct TerrainLayerDescription {
    #[wasm_bindgen(getter_with_clone)]
    pub r#type: String,
    #[wasm_bindgen(getter_with_clone)]
    pub url: String,
    pub segments: usize,
    pub max_z: usize,
    pub min_z: usize,
    pub wireframe: bool,
    pub elevation_decoder: Option<ElevationDecoder>,
    pub tile_size: Option<u32>,
}

#[wasm_bindgen]
#[derive(Debug, Default, Clone, Deserialize)]
pub struct GeoJsonLayerDescription {
    #[wasm_bindgen(getter_with_clone)]
    pub r#type: Option<String>,
    pub wireframe: Option<bool>,
    #[wasm_bindgen(getter_with_clone)]
    pub crs: Option<String>,

    // Appearances
    #[wasm_bindgen(getter_with_clone)]
    pub point: Option<PointMaterial>,
    #[wasm_bindgen(getter_with_clone)]
    pub billboard: Option<BillboardMaterial>,
    #[wasm_bindgen(getter_with_clone)]
    pub polyline: Option<PolylineMaterial>,
    #[wasm_bindgen(getter_with_clone)]
    pub polygon: Option<PolygonMaterial>,
    #[wasm_bindgen(getter_with_clone)]
    pub model: Option<ModelMaterial>,
}

impl GeoJsonLayerDescription {
    pub fn appearances(&mut self) -> Vec<Appearance> {
        let mut result = vec![];
        if let Some(v) = self.point.take() {
            result.push(Appearance::Point(v.into()));
        }
        if let Some(v) = self.billboard.take() {
            result.push(Appearance::Billboard(v.into()));
        }
        if let Some(v) = self.polyline.take() {
            result.push(Appearance::Polyline(v.into()));
        }
        if let Some(v) = self.polygon.take() {
            result.push(Appearance::Polygon(v.into()));
        }
        if let Some(v) = self.model.take() {
            result.push(Appearance::Model(v.into()));
        }
        result
    }

    pub fn crs(&self) -> Option<navara_core::CRS> {
        Some(match self.crs.as_ref()?.as_str() {
            "EPSG:4326" => CRS::Geographic,
            "EPSG:4978" => CRS::Geocentric,
            _ => CRS::ESPG {
                code: self.crs.clone().unwrap(),
            },
        })
    }
}

#[wasm_bindgen]
#[derive(Debug, Clone, Deserialize)]
pub struct LayerDescription {
    #[wasm_bindgen(getter_with_clone)]
    pub r#type: Option<String>,
}

#[wasm_bindgen]
#[derive(Debug, Clone, Deserialize)]
pub struct GeoJsonLayerDescriptionData {
    #[wasm_bindgen(getter_with_clone)]
    #[serde(with = "serde_wasm_bindgen::preserve")]
    pub data: JsValue,
}

#[wasm_bindgen]
#[derive(Debug, Clone, PartialEq, Default, Copy, Deserialize)]
pub struct ElevationDecoder {
    pub r_scaler: FloatType,
    pub g_scaler: FloatType,
    pub b_scaler: FloatType,
    pub offset: FloatType,
    pub max_offset: FloatType,
    pub min_offset: FloatType,
    pub boundary: FloatType,
    pub epsilon: FloatType,
}

impl LayerDescription {
    pub fn from(value: JsValue) -> Option<Self> {
        serde_wasm_bindgen::from_value(value).ok()
    }

    pub fn to(layer_id: &String, layer_type: &str, value: JsValue) -> Option<navara_layer::LayerDescription> {
        match layer_type {
            "tiles" => {
                let layer: TileLayerDescription = serde_wasm_bindgen::from_value(value).ok()?;
                Some(navara_layer::LayerDescription::Tiles(TilesLayer {
                    layer_id: layer_id.clone(),
                    url: layer.url,
                    segments: layer.segments,
                    color: layer.color,
                    max_sse: layer.max_sse.unwrap_or(4.),
                    max_z: layer.max_z,
                    wireframe: layer.wireframe,
                }))
            }
            "terrain" => {
                let layer: TerrainLayerDescription = serde_wasm_bindgen::from_value(value).ok()?;
                Some(navara_layer::LayerDescription::Terrain(TerrainLayer {
                    layer_id: layer_id.clone(),
                    url: layer.url.clone(),
                    segments: layer.segments,
                    max_z: layer.max_z,
                    min_z: layer.min_z,
                    wireframe: layer.wireframe,
                    elevation_decoder: layer.elevation_decoder.unwrap_or_default().into(),
                    terrain_type: TerrainDataType::from_url(&layer.url),
                    tile_size: layer.tile_size.unwrap_or(256),
                }))
            }
            "geojson" => {
                let js_data: GeoJsonLayerDescriptionData = serde_wasm_bindgen::from_value(value.clone()).unwrap_or_else(|_e| {
                    GeoJsonLayerDescriptionData { data: JsValue::NULL }
                });

                let mut geo_data: Option<GeoJson> = None;
                if !js_data.data.is_null() && !js_data.data.is_undefined() {
                    geo_data = GeoJson::from_json_object(js_data.data.into_serde().ok()?).ok();
                }

                let mut layer: GeoJsonLayerDescription = serde_wasm_bindgen::from_value(value).ok()?;

                Some(navara_layer::LayerDescription::GeoJson(GeoJsonLayer {
                    layer_id: layer_id.clone(),
                    data: geo_data,
                    appearances: layer.appearances(),
                    crs: layer.crs(),
                }))
            }
            _ => None,
        }
    }
}

impl From<ElevationDecoder> for navara_core::terrain::ElevationDecoder {
    fn from(d: ElevationDecoder) -> Self {
        navara_core::terrain::ElevationDecoder {
            r_scaler: d.r_scaler,
            g_scaler: d.g_scaler,
            b_scaler: d.b_scaler,
            offset: d.offset,
            max_offset: d.max_offset,
            min_offset: d.min_offset,
            boundary: d.boundary,
            epsilon: d.epsilon,
        }
    }
}
