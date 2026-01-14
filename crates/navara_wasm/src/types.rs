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
    pub r#type: Option<String>,
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
    pub fn appearance(
        &mut self,
        old_desc: Option<navara_layer::LayerDescription>,
    ) -> Option<navara_material::Appearance> {
        // Merge with old appearance if exists
        if let Some(navara_layer::LayerDescription::Tiles(old_layer)) = old_desc {
            if let (Some(new_tile_material), Some(old_appearance)) =
                (self.raster_tile.take(), old_layer.appearance.as_ref())
            {
                match old_appearance {
                    navara_material::Appearance::RasterTile(old_tile_material) => {
                        let updated_tile_material = new_tile_material.merge(old_tile_material);
                        return Some(Appearance::RasterTile(updated_tile_material));
                    }
                    _ => unreachable!(),
                }
            }
        }
        // Otherwise, return new appearance
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
    pub fn appearances(
        &mut self,
        old_desc: Option<navara_layer::LayerDescription>,
    ) -> Vec<Appearance> {
        // Merge with old appearances if exists
        let appearances = if let Some(navara_layer::LayerDescription::GeoJson(old_layer)) = old_desc
        {
            let mut result = old_layer.appearances.clone();
            if let Some(new_point_material) = self.point.take() {
                // Merge with the old material if exists.
                if let Some(old_appearance) = old_layer
                    .appearances
                    .iter()
                    .find(|a| matches!(a, Appearance::Point(_)))
                {
                    if let Appearance::Point(old_point_material) = old_appearance {
                        let updated_point_material = new_point_material.merge(old_point_material);
                        // Replace the old appearance with the updated one.
                        result.retain(|a| !matches!(a, Appearance::Point(_)));
                        result.push(Appearance::Point(updated_point_material));
                    }
                } else {
                    result.push(Appearance::Point(new_point_material.into()));
                }
            }

            if let Some(new_billboard_material) = self.billboard.take() {
                // Merge with the old material if exists.
                if let Some(old_appearance) = old_layer
                    .appearances
                    .iter()
                    .find(|a| matches!(a, Appearance::Billboard(_)))
                {
                    if let Appearance::Billboard(old_billboard_material) = old_appearance {
                        let updated_billboard_material =
                            new_billboard_material.merge(old_billboard_material);
                        // Replace the old appearance with the updated one.
                        result.retain(|a| !matches!(a, Appearance::Billboard(_)));
                        result.push(Appearance::Billboard(updated_billboard_material));
                    }
                } else {
                    result.push(Appearance::Billboard(
                        new_billboard_material.to_owned().into(),
                    ));
                }
            }

            if let Some(new_text_material) = self.text.take() {
                // Merge with the old material if exists.
                if let Some(old_appearance) = old_layer
                    .appearances
                    .iter()
                    .find(|a| matches!(a, Appearance::Text(_)))
                {
                    if let Appearance::Text(old_text_material) = old_appearance {
                        let updated_text_material = new_text_material.merge(old_text_material);
                        // Replace the old appearance with the updated one.
                        result.retain(|a| !matches!(a, Appearance::Text(_)));
                        result.push(Appearance::Text(updated_text_material));
                    }
                } else {
                    result.push(Appearance::Text(new_text_material.into()));
                }
            }

            if let Some(new_polyline_material) = self.polyline.take() {
                // Merge with the old material if exists.
                if let Some(old_appearance) = old_layer
                    .appearances
                    .iter()
                    .find(|a| matches!(a, Appearance::Polyline(_)))
                {
                    if let Appearance::Polyline(old_polyline_material) = old_appearance {
                        let updated_polyline_material =
                            new_polyline_material.merge(old_polyline_material);
                        // Replace the old appearance with the updated one.
                        result.retain(|a| !matches!(a, Appearance::Polyline(_)));
                        result.push(Appearance::Polyline(updated_polyline_material));
                    }
                } else {
                    result.push(Appearance::Polyline(new_polyline_material.into()));
                }
            }

            if let Some(new_polygon_material) = self.polygon.take() {
                // Merge with the old material if exists.
                if let Some(old_appearance) = old_layer
                    .appearances
                    .iter()
                    .find(|a| matches!(a, Appearance::Polygon(_)))
                {
                    if let Appearance::Polygon(old_polygon_material) = old_appearance {
                        let updated_polygon_material =
                            new_polygon_material.merge(old_polygon_material);
                        // Replace the old appearance with the updated one.
                        result.retain(|a| !matches!(a, Appearance::Polygon(_)));
                        result.push(Appearance::Polygon(updated_polygon_material));
                    }
                } else {
                    result.push(Appearance::Polygon(new_polygon_material.into()));
                }
            }

            if let Some(new_model_material) = self.model.take() {
                // Merge with the old material if exists.
                if let Some(old_appearance) = old_layer
                    .appearances
                    .iter()
                    .find(|a| matches!(a, Appearance::Model(_)))
                {
                    if let Appearance::Model(old_model_material) = old_appearance {
                        let updated_model_material = new_model_material.merge(old_model_material);
                        // Replace the old appearance with the updated one.
                        result.retain(|a| !matches!(a, Appearance::Model(_)));
                        result.push(Appearance::Model(updated_model_material));
                    }
                } else {
                    result.push(Appearance::Model(new_model_material.into()));
                }
            }
            result
        } else {
            // Otherwise, return new appearances
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
        };
        appearances
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
    pub fn appearances(
        &mut self,
        old_desc: Option<navara_layer::LayerDescription>,
    ) -> Vec<Appearance> {
        let mut result = vec![];
        // Merge with old appearance if exists
        if let Some(navara_layer::LayerDescription::B3dm(old_layer)) = old_desc {
            if let (Some(new_model_material), Some(old_appearance)) =
                (self.model.take(), old_layer.appearances.first())
            {
                match old_appearance {
                    navara_material::Appearance::Model(old_model_material) => {
                        let updated_model_material = new_model_material.merge(old_model_material);
                        result.push(Appearance::Model(updated_model_material));
                        return result;
                    }
                    _ => unreachable!(),
                }
            }
        }
        // Otherwise, return new appearance
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
    pub fn appearances(
        &mut self,
        old_desc: Option<navara_layer::LayerDescription>,
    ) -> Vec<Appearance> {
        let mut result = vec![];
        // Merge with old appearance if exists
        if let Some(navara_layer::LayerDescription::Pnts(old_layer)) = old_desc {
            if let (Some(new_model_material), Some(old_appearance)) =
                (self.model.take(), old_layer.appearances.first())
            {
                match old_appearance {
                    navara_material::Appearance::Model(old_model_material) => {
                        let updated_model_material = new_model_material.merge(old_model_material);
                        result.push(Appearance::Model(updated_model_material));
                        return result;
                    }
                    _ => unreachable!(),
                }
            }
        }
        // Otherwise, return new appearance
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
    pub fn appearances(
        &mut self,
        old_desc: Option<navara_layer::LayerDescription>,
    ) -> Vec<Appearance> {
        let mut result = vec![];
        // Merge with old appearance if exists
        if let Some(navara_layer::LayerDescription::Cesium3dTiles(old_layer)) = old_desc {
            if let (Some(new_model_material), Some(old_appearance)) =
                (self.model.take(), old_layer.appearances.first())
            {
                match old_appearance {
                    navara_material::Appearance::Model(old_model_material) => {
                        let updated_model_material = new_model_material.merge(old_model_material);
                        result.push(Appearance::Model(updated_model_material));
                        return result;
                    }
                    _ => unreachable!(),
                }
            }
        }
        // Otherwise, return new appearance
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
    pub fn appearances(
        &mut self,
        old_desc: Option<navara_layer::LayerDescription>,
    ) -> Vec<Appearance> {
        // Merge with old appearances if exists
        let appearances = if let Some(navara_layer::LayerDescription::Mvt(old_layer)) = old_desc {
            let mut result = old_layer.appearances.clone();
            if let Some(new_point_material) = self.point.take() {
                // Merge with the old material if exists.
                if let Some(old_appearance) = old_layer
                    .appearances
                    .iter()
                    .find(|a| matches!(a, Appearance::Point(_)))
                {
                    if let Appearance::Point(old_point_material) = old_appearance {
                        let updated_point_material = new_point_material.merge(old_point_material);
                        // Replace the old appearance with the updated one.
                        result.retain(|a| !matches!(a, Appearance::Point(_)));
                        result.push(Appearance::Point(updated_point_material));
                    }
                } else {
                    result.push(Appearance::Point(new_point_material.into()));
                }
            }

            if let Some(new_billboard_material) = self.billboard.take() {
                // Merge with the old material if exists.
                if let Some(old_appearance) = old_layer
                    .appearances
                    .iter()
                    .find(|a| matches!(a, Appearance::Billboard(_)))
                {
                    if let Appearance::Billboard(old_billboard_material) = old_appearance {
                        let updated_billboard_material =
                            new_billboard_material.merge(old_billboard_material);
                        // Replace the old appearance with the updated one.
                        result.retain(|a| !matches!(a, Appearance::Billboard(_)));
                        result.push(Appearance::Billboard(updated_billboard_material));
                    }
                } else {
                    result.push(Appearance::Billboard(
                        new_billboard_material.to_owned().into(),
                    ));
                }
            }

            if let Some(new_text_material) = self.text.take() {
                // Merge with the old material if exists.
                if let Some(old_appearance) = old_layer
                    .appearances
                    .iter()
                    .find(|a| matches!(a, Appearance::Text(_)))
                {
                    if let Appearance::Text(old_text_material) = old_appearance {
                        let updated_text_material = new_text_material.merge(old_text_material);
                        // Replace the old appearance with the updated one.
                        result.retain(|a| !matches!(a, Appearance::Text(_)));
                        result.push(Appearance::Text(updated_text_material));
                    }
                } else {
                    result.push(Appearance::Text(new_text_material.into()));
                }
            }

            if let Some(new_polyline_material) = self.polyline.take() {
                // Merge with the old material if exists.
                if let Some(old_appearance) = old_layer
                    .appearances
                    .iter()
                    .find(|a| matches!(a, Appearance::Polyline(_)))
                {
                    if let Appearance::Polyline(old_polyline_material) = old_appearance {
                        let updated_polyline_material =
                            new_polyline_material.merge(old_polyline_material);
                        // Replace the old appearance with the updated one.
                        result.retain(|a| !matches!(a, Appearance::Polyline(_)));
                        result.push(Appearance::Polyline(updated_polyline_material));
                    }
                } else {
                    result.push(Appearance::Polyline(new_polyline_material.into()));
                }
            }

            if let Some(new_polygon_material) = self.polygon.take() {
                // Merge with the old material if exists.
                if let Some(old_appearance) = old_layer
                    .appearances
                    .iter()
                    .find(|a| matches!(a, Appearance::Polygon(_)))
                {
                    if let Appearance::Polygon(old_polygon_material) = old_appearance {
                        let updated_polygon_material =
                            new_polygon_material.merge(old_polygon_material);
                        // Replace the old appearance with the updated one.
                        result.retain(|a| !matches!(a, Appearance::Polygon(_)));
                        result.push(Appearance::Polygon(updated_polygon_material));
                    }
                } else {
                    result.push(Appearance::Polygon(new_polygon_material.into()));
                }
            }

            if let Some(new_vector_tile_material) = self.vector_tile.take() {
                // Merge with the old material if exists.
                if let Some(old_appearance) = old_layer
                    .appearances
                    .iter()
                    .find(|a| matches!(a, Appearance::VectorTile(_)))
                {
                    if let Appearance::VectorTile(old_vector_tile_material) = old_appearance {
                        let updated_vector_tile_material =
                            new_vector_tile_material.merge(old_vector_tile_material);
                        // Replace the old appearance with the updated one.
                        result.retain(|a| !matches!(a, Appearance::VectorTile(_)));
                        result.push(Appearance::VectorTile(updated_vector_tile_material));
                    }
                } else {
                    result.push(Appearance::VectorTile(new_vector_tile_material.into()));
                }
            }
            result
        } else {
            // Otherwise, return new appearances
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
        };
        appearances
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
        old_desc: Option<navara_layer::LayerDescription>,
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
                        appearance: layer.appearance(old_desc),
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
                        appearances: layer.appearances(old_desc),
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
                    appearances: layer.appearances(old_desc),
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
                    appearances: layer.appearances(old_desc),
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
                    appearances: layer.appearances(old_desc),
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
                        appearances: layer.appearances(old_desc),
                        crs: layer.crs(),
                    },
                ))
            }
            _ => None,
        }
    }
}
