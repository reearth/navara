use gloo_utils::format::JsValueSerdeExt;
use navara_core::CRS;

use navara_layer::{
    B3dmLayer, Cesium3dTilesLayer, GeoJsonLayer, LayerData, MvtLayer, TerrainDataType,
    TerrainLayer, TilesLayer,
};

use navara_material::Appearance;
use navara_parser::geojson::GeoJson;
use serde::Deserialize;
use wasm_bindgen::prelude::*;

use crate::appearance::{
    BillboardMaterial, ModelMaterial, PointMaterial, PolygonMaterial, PolylineMaterial,
    RasterTerrainMaterial, RasterTileMaterial,
};

#[wasm_bindgen]
#[derive(Debug, Clone, Deserialize)]
pub struct TileLayerDescription {
    #[wasm_bindgen(getter_with_clone)]
    pub r#type: String,
    #[wasm_bindgen(getter_with_clone)]
    #[serde(skip_deserializing)]
    pub data: JsValue,

    #[wasm_bindgen(getter_with_clone)]
    pub raster_tile: Option<RasterTileMaterial>,
}

impl TileLayerDescription {
    pub fn appearance(&mut self) -> Option<navara_material::RasterTileMaterial> {
        self.raster_tile.take().map(|v| v.into())
    }
}

#[wasm_bindgen]
#[derive(Debug, Clone, Deserialize)]
pub struct TerrainLayerDescription {
    #[wasm_bindgen(getter_with_clone)]
    pub r#type: String,
    #[wasm_bindgen(getter_with_clone)]
    #[serde(skip_deserializing)]
    pub data: JsValue,

    #[wasm_bindgen(getter_with_clone)]
    pub raster_terrain: Option<RasterTerrainMaterial>,

    /// Compute normals from vertices if the model doesn't have a normal.
    pub should_compute_normal_from_vertex: Option<bool>,
}

impl TerrainLayerDescription {
    pub fn appearance(&mut self) -> Option<navara_material::RasterTerrainMaterial> {
        self.raster_terrain.take().map(|v| v.into())
    }
}

#[wasm_bindgen]
#[derive(Debug, Default, Clone, Deserialize)]
pub struct GeoJsonLayerDescription {
    #[wasm_bindgen(getter_with_clone)]
    pub r#type: Option<String>,
    #[wasm_bindgen(getter_with_clone)]
    pub crs: Option<String>,
    #[wasm_bindgen(getter_with_clone)]
    #[serde(skip_deserializing)]
    pub data: JsValue,

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
        Some(CRS::from_str(self.crs.as_ref()?.as_str()))
    }
}

// This is used for debugging.
#[wasm_bindgen]
#[derive(Debug, Default, Clone, Deserialize)]
pub struct B3dmLayerDescription {
    #[wasm_bindgen(getter_with_clone)]
    pub r#type: Option<String>,
    #[wasm_bindgen(getter_with_clone)]
    pub crs: Option<String>,
    #[wasm_bindgen(getter_with_clone)]
    #[serde(skip_deserializing)]
    pub data: JsValue,

    // Appearances
    #[wasm_bindgen(getter_with_clone)]
    pub model: Option<ModelMaterial>,
}

impl B3dmLayerDescription {
    pub fn appearances(&mut self) -> Vec<Appearance> {
        let mut result = vec![];
        if let Some(v) = self.model.take() {
            result.push(Appearance::Model(v.into()));
        }
        result
    }

    pub fn crs(&self) -> Option<navara_core::CRS> {
        Some(CRS::from_str(self.crs.as_ref()?.as_str()))
    }
}

#[wasm_bindgen]
#[derive(Debug, Default, Clone, Deserialize)]
pub struct Cesium3dTilesLayerDescription {
    #[wasm_bindgen(getter_with_clone)]
    pub r#type: Option<String>,
    #[wasm_bindgen(getter_with_clone)]
    pub crs: Option<String>,
    #[wasm_bindgen(getter_with_clone)]
    #[serde(skip_deserializing)]
    pub data: JsValue,

    // Appearances
    #[wasm_bindgen(getter_with_clone)]
    pub model: Option<ModelMaterial>,
}

impl Cesium3dTilesLayerDescription {
    pub fn appearances(&mut self) -> Vec<Appearance> {
        let mut result = vec![];
        if let Some(v) = self.model.take() {
            result.push(Appearance::Model(v.into()));
        }
        result
    }

    pub fn crs(&self) -> Option<navara_core::CRS> {
        Some(CRS::from_str(self.crs.as_ref()?.as_str()))
    }
}

#[wasm_bindgen]
#[derive(Debug, Default, Clone, Deserialize)]
pub struct MvtLayerDescription {
    #[wasm_bindgen(getter_with_clone)]
    pub r#type: Option<String>,
    #[wasm_bindgen(getter_with_clone)]
    pub crs: Option<String>,
    #[wasm_bindgen(getter_with_clone)]
    #[serde(skip_deserializing)]
    pub data: JsValue,

    // Appearances
    #[wasm_bindgen(getter_with_clone)]
    pub point: Option<PointMaterial>,
    #[wasm_bindgen(getter_with_clone)]
    pub billboard: Option<BillboardMaterial>,
    #[wasm_bindgen(getter_with_clone)]
    pub polyline: Option<PolylineMaterial>,
    #[wasm_bindgen(getter_with_clone)]
    pub polygon: Option<PolygonMaterial>,
}

impl MvtLayerDescription {
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
        result
    }

    pub fn crs(&self) -> Option<navara_core::CRS> {
        Some(CRS::from_str(self.crs.as_ref()?.as_str()))
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
pub struct LayerDescriptionData {
    #[wasm_bindgen(getter_with_clone)]
    #[serde(with = "serde_wasm_bindgen::preserve")]
    pub data: JsValue,
}

#[wasm_bindgen]
#[derive(Debug, Clone, Deserialize)]
pub struct LayerDescriptionUrl {
    #[wasm_bindgen(getter_with_clone)]
    pub url: String,
}

impl LayerDescription {
    pub fn from(value: JsValue) -> Option<Self> {
        serde_wasm_bindgen::from_value(value).ok()
    }

    pub fn to(
        layer_id: &str,
        layer_type: &str,
        value: JsValue,
    ) -> Option<navara_layer::LayerDescription> {
        match layer_type {
            "tiles" => {
                let js_data: LayerDescriptionData = serde_wasm_bindgen::from_value(value.clone())
                    .unwrap_or_else(|_e| LayerDescriptionData {
                        data: JsValue::NULL,
                    });

                let mut data: Option<LayerDescriptionUrl> = None;
                if !js_data.data.is_null() && !js_data.data.is_undefined() {
                    data = serde_wasm_bindgen::from_value(js_data.data).ok()?;
                }

                let mut layer: TileLayerDescription = serde_wasm_bindgen::from_value(value).ok()?;

                Some(navara_layer::LayerDescription::Tiles(TilesLayer {
                    layer_id: layer_id.to_string(),
                    data: data.map(|d| LayerData { url: d.url }),
                    appearance: layer.appearance(),
                }))
            }
            "terrain" => {
                let js_data: LayerDescriptionData = serde_wasm_bindgen::from_value(value.clone())
                    .unwrap_or_else(|_e| LayerDescriptionData {
                        data: JsValue::NULL,
                    });

                let mut data: Option<LayerDescriptionUrl> = None;
                if !js_data.data.is_null() && !js_data.data.is_undefined() {
                    data = serde_wasm_bindgen::from_value(js_data.data).ok()?;
                }

                let url = data.as_ref().unwrap().url.as_str();

                let mut layer: TerrainLayerDescription =
                    serde_wasm_bindgen::from_value(value).ok()?;

                Some(navara_layer::LayerDescription::Terrain(TerrainLayer {
                    layer_id: layer_id.to_string(),
                    data: Some(LayerData {
                        url: String::from(url),
                    }),
                    appearance: layer.appearance(),
                    should_compute_normal_from_vertex: layer
                        .should_compute_normal_from_vertex
                        .unwrap_or(true),
                    terrain_type: TerrainDataType::from_url(url),
                }))
            }
            "geojson" => {
                let js_data: LayerDescriptionData = serde_wasm_bindgen::from_value(value.clone())
                    .unwrap_or_else(|_e| LayerDescriptionData {
                        data: JsValue::NULL,
                    });

                let mut geo_data: Option<GeoJson> = None;
                if !js_data.data.is_null() && !js_data.data.is_undefined() {
                    geo_data = GeoJson::from_json_object(js_data.data.into_serde().ok()?).ok();
                }

                let mut layer: GeoJsonLayerDescription =
                    serde_wasm_bindgen::from_value(value).ok()?;

                Some(navara_layer::LayerDescription::GeoJson(GeoJsonLayer {
                    layer_id: layer_id.to_string(),
                    data: geo_data,
                    appearances: layer.appearances(),
                    crs: layer.crs(),
                }))
            }
            "b3dm" => {
                let js_data: LayerDescriptionData = serde_wasm_bindgen::from_value(value.clone())
                    .unwrap_or_else(|_e| LayerDescriptionData {
                        data: JsValue::NULL,
                    });

                let mut data: Option<LayerDescriptionUrl> = None;
                if !js_data.data.is_null() && !js_data.data.is_undefined() {
                    data = serde_wasm_bindgen::from_value(js_data.data).ok()?;
                }

                let mut layer: B3dmLayerDescription = serde_wasm_bindgen::from_value(value).ok()?;

                Some(navara_layer::LayerDescription::B3dm(B3dmLayer {
                    layer_id: layer_id.to_string(),
                    data: data.map(|d| LayerData { url: d.url }),
                    appearances: layer.appearances(),
                    crs: layer.crs(),
                }))
            }
            "mvt" => {
                let js_data: LayerDescriptionData = serde_wasm_bindgen::from_value(value.clone())
                    .unwrap_or_else(|_e| LayerDescriptionData {
                        data: JsValue::NULL,
                    });

                let mut data: Option<LayerDescriptionUrl> = None;
                if !js_data.data.is_null() && !js_data.data.is_undefined() {
                    data = serde_wasm_bindgen::from_value(js_data.data).ok()?;
                }

                let mut layer: MvtLayerDescription = serde_wasm_bindgen::from_value(value).ok()?;

                Some(navara_layer::LayerDescription::Mvt(MvtLayer {
                    layer_id: layer_id.to_string(),
                    data: data.map(|d| LayerData { url: d.url }),
                    appearances: layer.appearances(),
                    crs: layer.crs(),
                }))
            }
            "cesium3dtiles" => {
                let js_data: LayerDescriptionData = serde_wasm_bindgen::from_value(value.clone())
                    .unwrap_or_else(|_e| LayerDescriptionData {
                        data: JsValue::NULL,
                    });

                let mut data: Option<LayerDescriptionUrl> = None;
                if !js_data.data.is_null() && !js_data.data.is_undefined() {
                    data = serde_wasm_bindgen::from_value(js_data.data).ok()?;
                }

                let mut layer: Cesium3dTilesLayerDescription =
                    serde_wasm_bindgen::from_value(value).ok()?;

                Some(navara_layer::LayerDescription::Cesium3dTiles(
                    Cesium3dTilesLayer {
                        layer_id: layer_id.to_string(),
                        data: data.map(|d| LayerData { url: d.url }),
                        appearances: layer.appearances(),
                        crs: layer.crs(),
                    },
                ))
            }
            _ => None,
        }
    }
}
