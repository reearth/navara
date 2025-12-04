use gloo_utils::format::JsValueSerdeExt;
use navara_core::CRS;

use navara_layer::{
    B3dmLayer, Cesium3dTilesLayer, GeoJsonLayer, GeoJsonLayerData, LayerData, MvtLayer, PntsLayer,
    TerrainDataType, TerrainLayer, TilesLayer,
};

use navara_material::{Appearance, ElevationHeatmapConfig};
use navara_parser::geojson::GeoJson;
use serde::Deserialize;
use wasm_bindgen::prelude::*;

use navara_wasm_types::{
    BillboardMaterial, ElevationHeatmapMaterial, EllipsoidTerrainMaterial, ModelMaterial,
    PointMaterial, PolygonMaterial, PolylineMaterial, RasterTerrainMaterial, RasterTileMaterial,
    TextMaterial, VectorTileMaterial,
};

#[wasm_bindgen]
#[derive(Debug, Clone, Deserialize)]
pub struct TileLayerDescription {
    #[wasm_bindgen(getter_with_clone)]
    pub r#type: String,
    #[wasm_bindgen(getter_with_clone)]
    #[serde(skip_deserializing)]
    pub data: JsValue,

    #[wasm_bindgen(getter_with_clone, js_name = rasterTile)]
    #[serde(rename = "rasterTile")]
    pub raster_tile: Option<RasterTileMaterial>,
    #[wasm_bindgen(getter_with_clone, js_name = elevationHeatmap)]
    #[serde(rename = "elevationHeatmap")]
    pub elevation_heatmap: Option<ElevationHeatmapMaterial>,
}

impl TileLayerDescription {
    pub fn appearance(&mut self) -> Option<navara_material::Appearance> {
        self.raster_tile
            .take()
            .map(|v| v.into())
            .map(Appearance::RasterTile)
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

    #[wasm_bindgen(getter_with_clone, js_name = rasterTerrain)]
    #[serde(rename = "rasterTerrain")]
    pub raster_terrain: Option<RasterTerrainMaterial>,
    #[wasm_bindgen(getter_with_clone)]
    pub ellipsoid: Option<EllipsoidTerrainMaterial>,
}

pub enum TerrainMaterial {
    Raster(navara_material::RasterTerrainMaterial),
    Ellipsoid(navara_material::EllipsoidTerrainMaterial),
}

impl TerrainLayerDescription {
    pub fn appearance(&mut self) -> Option<TerrainMaterial> {
        if let Some(v) = self.raster_terrain.take() {
            return Some(TerrainMaterial::Raster(v.into()));
        }
        if let Some(v) = self.ellipsoid.take() {
            return Some(TerrainMaterial::Ellipsoid(v.into()));
        }
        None
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
    pub text: Option<TextMaterial>,
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
        if let Some(v) = self.text.take() {
            result.push(Appearance::Text(v.into()));
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
pub struct PntsLayerDescription {
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

impl PntsLayerDescription {
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
    pub text: Option<TextMaterial>,
    #[wasm_bindgen(getter_with_clone)]
    pub polyline: Option<PolylineMaterial>,
    #[wasm_bindgen(getter_with_clone)]
    pub polygon: Option<PolygonMaterial>,
    #[wasm_bindgen(getter_with_clone, js_name = vectorTile)]
    #[serde(rename = "vectorTile")]
    pub vector_tile: Option<VectorTileMaterial>,
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
        if let Some(v) = self.text.take() {
            result.push(Appearance::Text(v.into()));
        }
        if let Some(v) = self.polyline.take() {
            result.push(Appearance::Polyline(v.into()));
        }
        if let Some(v) = self.polygon.take() {
            result.push(Appearance::Polygon(v.into()));
        }
        if let Some(v) = self.vector_tile.take() {
            result.push(Appearance::VectorTile(v.into()));
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

                // Parse elevation_heatmap config
                let elevation_heatmap_config =
                    layer.elevation_heatmap.as_ref().and_then(|heatmap| {
                        Some(ElevationHeatmapConfig {
                            max_height: heatmap.max_height.unwrap_or(1000.0),
                            min_height: heatmap.min_height.unwrap_or(0.0),
                            elevation_decoder: heatmap.elevation_decoder?.into(),
                            logarithmic: heatmap.logarithmic,
                            log_boundary: heatmap.log_boundary,
                        })
                    });

                Some(navara_layer::LayerDescription::Tiles(Box::new(
                    TilesLayer {
                        layer_id: layer_id.to_string(),
                        data: data.map(|d| LayerData { url: d.url }),
                        appearance: layer.appearance(),
                        elevation_heatmap_config,
                    },
                )))
            }
            "terrain" => {
                let js_data: LayerDescriptionData = serde_wasm_bindgen::from_value(value.clone())
                    .unwrap_or_else(|_e| LayerDescriptionData {
                        data: JsValue::NULL,
                    });

                let mut data: Option<LayerDescriptionUrl> = None;
                if !js_data.data.is_null() && !js_data.data.is_undefined() {
                    data = serde_wasm_bindgen::from_value(js_data.data).ok();
                }

                let mut layer: TerrainLayerDescription =
                    serde_wasm_bindgen::from_value(value).ok()?;

                let appearance = layer.appearance();

                // Determine terrain type and prepare data
                let (terrain_type, layer_data) = if appearance.is_some() {
                    match &appearance {
                        Some(TerrainMaterial::Ellipsoid(_)) => (TerrainDataType::Ellipsoid, None),
                        Some(TerrainMaterial::Raster(_)) => {
                            let url = data.as_ref()?.url.as_str();
                            (
                                TerrainDataType::from_url(url),
                                Some(LayerData {
                                    url: String::from(url),
                                }),
                            )
                        }
                        None => (TerrainDataType::Unknown, None),
                    }
                } else {
                    (TerrainDataType::Unknown, None)
                };

                let terrain_appearance = appearance.map(|mat| match mat {
                    TerrainMaterial::Raster(r) => navara_layer::TerrainAppearance::Raster(r),
                    TerrainMaterial::Ellipsoid(e) => navara_layer::TerrainAppearance::Ellipsoid(e),
                });

                Some(navara_layer::LayerDescription::Terrain(Box::new(
                    TerrainLayer {
                        layer_id: layer_id.to_string(),
                        data: layer_data,
                        appearance: terrain_appearance,
                        terrain_type,
                    },
                )))
            }
            "geojson" => {
                let js_data: LayerDescriptionData = serde_wasm_bindgen::from_value(value.clone())
                    .unwrap_or_else(|_e| LayerDescriptionData {
                        data: JsValue::NULL,
                    });

                let mut geo_data: Option<GeoJsonLayerData> = None;
                if !js_data.data.is_null() && !js_data.data.is_undefined() {
                    // Try to parse the data as URL first.
                    let data_url: Option<LayerDescriptionUrl> =
                        serde_wasm_bindgen::from_value(js_data.clone().data).ok();

                    if let Some(layer_description_url) = data_url {
                        geo_data = Some(GeoJsonLayerData::URL(layer_description_url.url));
                    } else {
                        // Try to parse the data as GeoJson if the URL is not provided.
                        let data_json: Option<GeoJson> =
                            GeoJson::from_json_object(js_data.data.into_serde().ok()?).ok();
                        geo_data = Some(GeoJsonLayerData::GeoJson(data_json.unwrap()));
                    }
                }

                let mut layer: GeoJsonLayerDescription =
                    serde_wasm_bindgen::from_value(value).ok()?;

                Some(navara_layer::LayerDescription::GeoJson(Box::new(
                    GeoJsonLayer {
                        layer_id: layer_id.to_string(),
                        data: geo_data,
                        appearances: layer.appearances(),
                        crs: layer.crs(),
                    },
                )))
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

                Some(navara_layer::LayerDescription::B3dm(Box::new(B3dmLayer {
                    layer_id: layer_id.to_string(),
                    data: data.map(|d| LayerData { url: d.url }),
                    appearances: layer.appearances(),
                    crs: layer.crs(),
                })))
            }
            "pnts" => {
                let js_data: LayerDescriptionData = serde_wasm_bindgen::from_value(value.clone())
                    .unwrap_or_else(|_e| LayerDescriptionData {
                        data: JsValue::NULL,
                    });

                let mut data: Option<LayerDescriptionUrl> = None;
                if !js_data.data.is_null() && !js_data.data.is_undefined() {
                    data = serde_wasm_bindgen::from_value(js_data.data).ok()?;
                }

                let mut layer: PntsLayerDescription = serde_wasm_bindgen::from_value(value).ok()?;

                Some(navara_layer::LayerDescription::Pnts(PntsLayer {
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
