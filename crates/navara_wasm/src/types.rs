use navara_core::CRS;

use navara_layer::{
    B3dmLayer, Cesium3dTilesLayer, GeoJsonLayer, MvtLayer, PntsLayer, TerrainDataType,
    TerrainLayer, TilesLayer,
};

use navara_material::{Appearance, ElevationHeatmapConfig, HillshadeConfig};
use serde::Deserialize;
use wasm_bindgen::prelude::*;

use navara_source::Source;
use navara_wasm_types::{
    BillboardMaterial, ElevationDecoder, ModelMaterial, PointMaterial, PolygonMaterial,
    PolylineMaterial, TextMaterial,
};

// ============================================================================
// Legacy inline-API material types.
//
// TODO: Remove with the legacy layer API. These preserve the legacy inline layer
// API's TypeScript surface, where fetch config (zoom / tms / decoder / tiling
// scheme / token) lived *inline* on the layer material. The new source-based API
// instead uses the slim `navara_wasm_types::{RasterMaterial, TerrainMaterial,
// HillshadeMaterial, ElevationHeatmapMaterial}` plus a `Source`. Here the fetch
// fields are consumed by `source_types::legacy_source` to build the implicit
// source; only the render fields are projected onto the shared render materials.
// ============================================================================

#[wasm_bindgen]
#[derive(Debug, Clone, Deserialize)]
pub struct LegacyRasterTileMaterial {
    pub show: Option<bool>,
    pub color: Option<u32>,
    pub opacity: Option<f32>,
    #[wasm_bindgen(js_name = showBoundingBox)]
    #[serde(rename = "showBoundingBox")]
    pub show_bounding_box: Option<bool>,
    #[wasm_bindgen(js_name = maxZoom)]
    #[serde(rename = "maxZoom")]
    pub max_zoom: Option<usize>,
    #[wasm_bindgen(js_name = minZoom)]
    #[serde(rename = "minZoom")]
    pub min_zoom: Option<usize>,
    pub tms: Option<bool>,
    #[wasm_bindgen(js_name = overscaledMaxZoom)]
    #[serde(rename = "overscaledMaxZoom")]
    pub overscaled_max_zoom: Option<usize>,
}

impl From<LegacyRasterTileMaterial> for navara_material::RasterMaterial {
    fn from(val: LegacyRasterTileMaterial) -> Self {
        val.merge(&navara_material::RasterMaterial::default())
    }
}

impl LegacyRasterTileMaterial {
    pub fn merge(
        &self,
        other: &navara_material::RasterMaterial,
    ) -> navara_material::RasterMaterial {
        navara_material::RasterMaterial {
            show: self.show.unwrap_or(other.show),
            color: self.color.unwrap_or(other.color),
            opacity: self.opacity.unwrap_or(other.opacity),
            show_bounding_box: self.show_bounding_box.unwrap_or(other.show_bounding_box),
        }
    }
}

#[wasm_bindgen]
#[derive(Debug, Clone, Deserialize)]
pub struct LegacyElevationHeatmapMaterial {
    #[wasm_bindgen(js_name = maxHeight)]
    #[serde(rename = "maxHeight")]
    pub max_height: Option<f64>,
    #[wasm_bindgen(js_name = minHeight)]
    #[serde(rename = "minHeight")]
    pub min_height: Option<f64>,
    #[wasm_bindgen(js_name = elevationDecoder)]
    #[serde(rename = "elevationDecoder")]
    pub elevation_decoder: Option<ElevationDecoder>,
    pub logarithmic: Option<bool>,
    #[wasm_bindgen(js_name = logBoundary)]
    #[serde(rename = "logBoundary")]
    pub log_boundary: Option<f64>,
}

#[wasm_bindgen]
#[derive(Debug, Clone, Deserialize)]
pub struct LegacyHillshadeMaterial {
    #[wasm_bindgen(js_name = elevationDecoder)]
    #[serde(rename = "elevationDecoder")]
    pub elevation_decoder: Option<ElevationDecoder>,
    /// Exaggeration factor for hillshade effect (default: 1.0)
    pub exaggeration: Option<f32>,
}

#[wasm_bindgen]
#[derive(Debug, Clone, Deserialize)]
pub struct LegacyRasterTerrainMaterial {
    pub show: Option<bool>,
    #[wasm_bindgen(js_name = castShadow)]
    #[serde(rename = "castShadow")]
    pub cast_shadow: Option<bool>,
    #[wasm_bindgen(js_name = receiveShadow)]
    #[serde(rename = "receiveShadow")]
    pub receive_shadow: Option<bool>,
    #[wasm_bindgen(js_name = showBoundingBox)]
    #[serde(rename = "showBoundingBox")]
    pub show_bounding_box: Option<bool>,
    #[wasm_bindgen(js_name = maxZoom)]
    #[serde(rename = "maxZoom")]
    pub max_zoom: Option<usize>,
    #[wasm_bindgen(js_name = overscaledMaxZoom)]
    #[serde(rename = "overscaledMaxZoom")]
    pub overscaled_max_zoom: Option<usize>,
    #[wasm_bindgen(js_name = minZoom)]
    #[serde(rename = "minZoom")]
    pub min_zoom: Option<usize>,
    #[wasm_bindgen(js_name = elevationDecoder)]
    #[serde(rename = "elevationDecoder")]
    pub elevation_decoder: Option<ElevationDecoder>,
    #[wasm_bindgen(js_name = tileSize)]
    #[serde(rename = "tileSize")]
    pub tile_size: Option<u32>,
    pub skirt: Option<bool>,
    #[wasm_bindgen(js_name = skirtExaggeration)]
    #[serde(rename = "skirtExaggeration")]
    pub skirt_exaggeration: Option<f32>,
}

impl From<LegacyRasterTerrainMaterial> for navara_material::TerrainMaterial {
    fn from(val: LegacyRasterTerrainMaterial) -> Self {
        let d = navara_material::TerrainMaterial::default();
        navara_material::TerrainMaterial {
            show: val.show.unwrap_or(d.show),
            cast_shadow: val.cast_shadow.unwrap_or(d.cast_shadow),
            receive_shadow: val.receive_shadow.unwrap_or(d.receive_shadow),
            show_bounding_box: val.show_bounding_box.unwrap_or(d.show_bounding_box),
            skirt: val.skirt.unwrap_or(d.skirt),
            skirt_exaggeration: val.skirt_exaggeration.unwrap_or(d.skirt_exaggeration),
        }
    }
}

#[wasm_bindgen]
#[derive(Debug, Clone, Deserialize)]
pub struct LegacyEllipsoidTerrainMaterial {
    #[wasm_bindgen(js_name = castShadow)]
    #[serde(rename = "castShadow")]
    pub cast_shadow: Option<bool>,
    #[wasm_bindgen(js_name = receiveShadow)]
    #[serde(rename = "receiveShadow")]
    pub receive_shadow: Option<bool>,
    #[wasm_bindgen(js_name = showBoundingBox)]
    #[serde(rename = "showBoundingBox")]
    pub show_bounding_box: Option<bool>,
    #[wasm_bindgen(js_name = maxZoom)]
    #[serde(rename = "maxZoom")]
    pub max_zoom: Option<usize>,
    #[wasm_bindgen(js_name = minZoom)]
    #[serde(rename = "minZoom")]
    pub min_zoom: Option<usize>,
}

impl From<LegacyEllipsoidTerrainMaterial> for navara_material::TerrainMaterial {
    fn from(val: LegacyEllipsoidTerrainMaterial) -> Self {
        let d = navara_material::TerrainMaterial::default();
        // The ellipsoid is always shown and never renders skirts (no tile gaps).
        navara_material::TerrainMaterial {
            show: true,
            cast_shadow: val.cast_shadow.unwrap_or(d.cast_shadow),
            receive_shadow: val.receive_shadow.unwrap_or(d.receive_shadow),
            show_bounding_box: val.show_bounding_box.unwrap_or(d.show_bounding_box),
            skirt: false,
            skirt_exaggeration: 1.0,
        }
    }
}

#[wasm_bindgen]
#[derive(Debug, Clone, Deserialize)]
pub struct LegacyQuantizedMeshTerrainMaterial {
    pub show: Option<bool>,
    #[wasm_bindgen(js_name = castShadow)]
    #[serde(rename = "castShadow")]
    pub cast_shadow: Option<bool>,
    #[wasm_bindgen(js_name = receiveShadow)]
    #[serde(rename = "receiveShadow")]
    pub receive_shadow: Option<bool>,
    #[wasm_bindgen(js_name = showBoundingBox)]
    #[serde(rename = "showBoundingBox")]
    pub show_bounding_box: Option<bool>,
    #[wasm_bindgen(js_name = maxZoom)]
    #[serde(rename = "maxZoom")]
    pub max_zoom: Option<usize>,
    #[wasm_bindgen(js_name = overscaledMaxZoom)]
    #[serde(rename = "overscaledMaxZoom")]
    pub overscaled_max_zoom: Option<usize>,
    #[wasm_bindgen(js_name = minZoom)]
    #[serde(rename = "minZoom")]
    pub min_zoom: Option<usize>,
    pub skirt: Option<bool>,
    #[wasm_bindgen(js_name = skirtExaggeration)]
    #[serde(rename = "skirtExaggeration")]
    pub skirt_exaggeration: Option<f32>,
    pub tms: Option<bool>,
    pub geographic: Option<bool>,
    #[wasm_bindgen(js_name = requestVertexNormals)]
    #[serde(rename = "requestVertexNormals")]
    pub request_vertex_normals: Option<bool>,
    #[wasm_bindgen(js_name = requestWaterMask)]
    #[serde(rename = "requestWaterMask")]
    pub request_water_mask: Option<bool>,
    #[wasm_bindgen(getter_with_clone)]
    pub token: Option<String>,
}

impl From<LegacyQuantizedMeshTerrainMaterial> for navara_material::TerrainMaterial {
    fn from(val: LegacyQuantizedMeshTerrainMaterial) -> Self {
        let d = navara_material::TerrainMaterial::default();
        navara_material::TerrainMaterial {
            show: val.show.unwrap_or(d.show),
            cast_shadow: val.cast_shadow.unwrap_or(d.cast_shadow),
            receive_shadow: val.receive_shadow.unwrap_or(d.receive_shadow),
            show_bounding_box: val.show_bounding_box.unwrap_or(d.show_bounding_box),
            skirt: val.skirt.unwrap_or(d.skirt),
            skirt_exaggeration: val.skirt_exaggeration.unwrap_or(d.skirt_exaggeration),
        }
    }
}

#[wasm_bindgen]
#[derive(Debug, Clone, Deserialize)]
pub struct LegacyVectorTileMaterial {
    pub show: Option<bool>,
    #[wasm_bindgen(js_name = castShadow)]
    #[serde(rename = "castShadow")]
    pub cast_shadow: Option<bool>,
    #[wasm_bindgen(js_name = receiveShadow)]
    #[serde(rename = "receiveShadow")]
    pub receive_shadow: Option<bool>,
    #[wasm_bindgen(js_name = minZoom)]
    #[serde(rename = "minZoom")]
    pub min_zoom: Option<usize>,
    #[wasm_bindgen(js_name = maxZoom)]
    #[serde(rename = "maxZoom")]
    pub max_zoom: Option<usize>,
    #[wasm_bindgen(js_name = maxSse)]
    #[serde(rename = "maxSse")]
    pub max_sse: Option<f32>,
    /// Per-layer horizon dynamic-SSE relaxation strength (`0.0` off … `1.0`
    /// raster-equivalent). Omit for a content-based default.
    #[wasm_bindgen(js_name = dynamicSseScale)]
    #[serde(rename = "dynamicSseScale")]
    pub dynamic_sse_scale: Option<f32>,
    /// Sub-layer filter (MapLibre's `source-layer`). This is the only render-side
    /// field; the rest is fetch config carried onto the implicit source.
    #[wasm_bindgen(getter_with_clone)]
    pub layers: Option<Vec<String>>,
    #[wasm_bindgen(js_name = overscaledMaxZoom)]
    #[serde(rename = "overscaledMaxZoom")]
    pub overscaled_max_zoom: Option<usize>,
}

#[wasm_bindgen]
#[derive(Debug, Clone, Deserialize)]
// TODO: Remove with the legacy layer API (superseded by source-based layers).
pub struct TileLayerDescription {
    #[wasm_bindgen(getter_with_clone)]
    pub r#type: Option<String>,
    #[wasm_bindgen(getter_with_clone)]
    #[serde(skip_deserializing)]
    pub data: JsValue,

    #[wasm_bindgen(getter_with_clone, js_name = rasterTile)]
    #[serde(rename = "rasterTile")]
    pub raster_tile: Option<LegacyRasterTileMaterial>,
    #[wasm_bindgen(getter_with_clone, js_name = elevationHeatmap)]
    #[serde(rename = "elevationHeatmap")]
    pub elevation_heatmap: Option<LegacyElevationHeatmapMaterial>,
    #[wasm_bindgen(getter_with_clone)]
    pub hillshade: Option<LegacyHillshadeMaterial>,
}

impl TileLayerDescription {
    pub fn appearance(
        &mut self,
        old_desc: Option<navara_layer::LayerDescription>,
    ) -> Option<navara_material::Appearance> {
        // Merge with old appearance if exists
        if let Some(navara_layer::LayerDescription::Tiles(old_layer)) = old_desc
            && let (Some(new_tile_material), Some(old_appearance)) =
                (self.raster_tile.take(), old_layer.appearance.as_ref())
        {
            match old_appearance {
                navara_material::Appearance::TerrainTile(old_tile_material) => {
                    let updated_tile_material = new_tile_material.merge(old_tile_material);
                    return Some(Appearance::TerrainTile(updated_tile_material));
                }
                _ => unreachable!(),
            }
        }
        // Otherwise, return new appearance
        self.raster_tile
            .take()
            .map(|v| v.into())
            .map(Appearance::TerrainTile)
    }
}

#[wasm_bindgen]
#[derive(Debug, Clone, Deserialize)]
// TODO: Remove with the legacy layer API (superseded by source-based layers).
pub struct TerrainLayerDescription {
    #[wasm_bindgen(getter_with_clone)]
    pub r#type: String,
    #[wasm_bindgen(getter_with_clone)]
    #[serde(skip_deserializing)]
    pub data: JsValue,

    // The legacy API splits terrain across three keys by data format; each
    // carries the same render fields plus its own fetch config. The data format
    // is derived from the implicit source (see `legacy_source`); all three
    // project onto the unified `navara_material::TerrainMaterial`.
    #[wasm_bindgen(getter_with_clone, js_name = rasterTerrain)]
    #[serde(rename = "rasterTerrain")]
    pub raster_terrain: Option<LegacyRasterTerrainMaterial>,
    #[wasm_bindgen(getter_with_clone)]
    pub ellipsoid: Option<LegacyEllipsoidTerrainMaterial>,
    #[wasm_bindgen(getter_with_clone, js_name = quantizedMesh)]
    #[serde(rename = "quantizedMesh")]
    pub quantized_mesh: Option<LegacyQuantizedMeshTerrainMaterial>,
}

impl TerrainLayerDescription {
    /// Project whichever terrain key is present onto the unified render material.
    /// The data format itself is derived from the implicit source in [`LayerDescription::to`].
    pub fn appearance(&mut self) -> Option<navara_material::TerrainMaterial> {
        if let Some(v) = self.raster_terrain.take() {
            return Some(v.into());
        }
        if let Some(v) = self.ellipsoid.take() {
            return Some(v.into());
        }
        if let Some(v) = self.quantized_mesh.take() {
            return Some(v.into());
        }
        None
    }
}

/// GeoJSON layer description for configuring feature rendering.
///
/// **Note**: Model appearance is intentionally not supported for GeoJSON layers.
/// The batched feature pipeline requires per-batch coordinate transforms (model matrices)
/// and animation support, which are incompatible with the current GeoJSON batching approach.
/// For 3D model rendering at geographic coordinates, use a mesh description (e.g. `GLTFModelDesc`)
/// instead.
#[wasm_bindgen]
#[derive(Debug, Default, Clone, Deserialize)]
// TODO: Remove with the legacy layer API (superseded by source-based layers).
pub struct GeoJsonLayerDescription {
    #[wasm_bindgen(getter_with_clone)]
    pub r#type: Option<String>,
    #[wasm_bindgen(getter_with_clone)]
    pub crs: Option<String>,
    #[wasm_bindgen(getter_with_clone)]
    #[serde(skip_deserializing)]
    pub data: JsValue,
    /// Per-layer horizon dynamic-SSE relaxation strength for the tiled render
    /// path (`0.0` off … `1.0` raster-equivalent). Omit for a content-based
    /// default.
    #[wasm_bindgen(js_name = dynamicSseScale)]
    #[serde(rename = "dynamicSseScale")]
    pub dynamic_sse_scale: Option<f32>,

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
}

impl GeoJsonLayerDescription {
    pub fn appearances(
        &mut self,
        old_desc: Option<navara_layer::LayerDescription>,
    ) -> Vec<Appearance> {
        // Merge with old appearances if exists

        if let Some(navara_layer::LayerDescription::GeoJson(old_layer)) = old_desc {
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
            result
        }
    }

    pub fn crs(&self) -> Option<navara_core::CRS> {
        Some(CRS::from_str(self.crs.as_ref()?.as_str()))
    }
}

// This is used for debugging.
#[wasm_bindgen]
#[derive(Debug, Default, Clone, Deserialize)]
// TODO: Remove with the legacy layer API (superseded by source-based layers).
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
        if let Some(navara_layer::LayerDescription::B3dm(old_layer)) = old_desc
            && let (Some(new_model_material), Some(old_appearance)) =
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
// TODO: Remove with the legacy layer API (superseded by source-based layers).
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
        if let Some(navara_layer::LayerDescription::Pnts(old_layer)) = old_desc
            && let (Some(new_model_material), Some(old_appearance)) =
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
// TODO: Remove with the legacy layer API (superseded by source-based layers).
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
        if let Some(navara_layer::LayerDescription::Cesium3dTiles(old_layer)) = old_desc
            && let (Some(new_model_material), Some(old_appearance)) =
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
// TODO: Remove with the legacy layer API (superseded by source-based layers).
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
    pub vector_tile: Option<LegacyVectorTileMaterial>,
}

impl MvtLayerDescription {
    pub fn appearances(
        &mut self,
        old_desc: Option<navara_layer::LayerDescription>,
    ) -> Vec<Appearance> {
        // Merge with old appearances if exists

        if let Some(navara_layer::LayerDescription::Mvt(old_layer)) = old_desc {
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
            result
        }
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
// TODO: Remove with the legacy layer API (the legacy inline `data: { url }` shape).
pub struct LayerDescriptionData {
    #[wasm_bindgen(getter_with_clone)]
    #[serde(with = "serde_wasm_bindgen::preserve")]
    pub data: JsValue,
}

#[wasm_bindgen]
#[derive(Debug, Clone, Deserialize)]
// TODO: Remove with the legacy layer API (the legacy inline `data: { url }` shape).
pub struct LayerDescriptionUrl {
    #[wasm_bindgen(getter_with_clone)]
    pub url: String,
}

impl LayerDescription {
    pub fn from(value: JsValue) -> Option<Self> {
        serde_wasm_bindgen::from_value(value).ok()
    }

    // TODO: Remove with the legacy layer API. Converts a legacy layer
    // description (inline fetch config) into the internal layer; the
    // source-based API uses `source_types::build_source_layer` instead.
    pub fn to(
        layer_id: &str,
        layer_type: &str,
        value: JsValue,
        old_desc: Option<navara_layer::LayerDescription>,
        source: Option<&Source>,
    ) -> Option<navara_layer::LayerDescription> {
        // The implicit source (built by `legacy_source`) is the single source of
        // truth for fetch config; the layer only references it by id and reads
        // any decoder from it, mirroring `source_types::build_source_layer`.
        let source_id = source.map(|s| s.source_id().to_owned());
        match layer_type {
            "tiles" => {
                let mut layer: TileLayerDescription = serde_wasm_bindgen::from_value(value).ok()?;

                // Hillshade / heatmap configs carry render params only; the DEM
                // decoder is read live from the referenced source where it's
                // used, exactly like `RasterLayerDescription::build`.
                let elevation_heatmap_config =
                    layer
                        .elevation_heatmap
                        .as_ref()
                        .map(|heatmap| ElevationHeatmapConfig {
                            max_height: heatmap.max_height.unwrap_or(1000.0),
                            min_height: heatmap.min_height.unwrap_or(0.0),
                            logarithmic: heatmap.logarithmic.unwrap_or(false),
                            log_boundary: heatmap.log_boundary.unwrap_or(0.0),
                        });

                let hillshade_config = layer.hillshade.as_ref().map(|hillshade| HillshadeConfig {
                    exaggeration: hillshade.exaggeration.unwrap_or(1.0),
                });

                Some(navara_layer::LayerDescription::Tiles(Box::new(
                    TilesLayer {
                        layer_id: layer_id.to_string(),
                        source_id: source_id.clone(),
                        appearance: layer.appearance(old_desc),
                        elevation_heatmap_config,
                        hillshade_config,
                    },
                )))
            }
            "terrain" => {
                let mut layer: TerrainLayerDescription =
                    serde_wasm_bindgen::from_value(value).ok()?;

                // The data format is derived from the implicit source built by
                // `legacy_source`. Source-less terrain is the ellipsoid, which is
                // render-only (no fetch config). The render material is unified;
                // the ellipsoid's skirt-less default is baked into its `From`.
                let terrain_type = match source {
                    Some(Source::RasterDem(_)) => TerrainDataType::RasterDEM,
                    Some(Source::QuantizedMesh(_)) => TerrainDataType::QuantizedMesh,
                    None => TerrainDataType::Ellipsoid,
                    _ => TerrainDataType::Unknown,
                };

                Some(navara_layer::LayerDescription::Terrain(Box::new(
                    TerrainLayer {
                        layer_id: layer_id.to_string(),
                        source_id: source_id.clone(),
                        appearance: layer.appearance(),
                        terrain_type,
                    },
                )))
            }
            "geojson" => {
                // The GeoJSON data (inline or URL) lives on the implicit source
                // built by `legacy_source`; the layer only references it.
                let mut layer: GeoJsonLayerDescription =
                    serde_wasm_bindgen::from_value(value).ok()?;

                Some(navara_layer::LayerDescription::GeoJson(Box::new(
                    GeoJsonLayer {
                        layer_id: layer_id.to_string(),
                        source_id: source_id.clone(),
                        appearances: layer.appearances(old_desc),
                        crs: layer.crs(),
                        dynamic_sse_scale: layer.dynamic_sse_scale,
                    },
                )))
            }
            "b3dm" => {
                let mut layer: B3dmLayerDescription = serde_wasm_bindgen::from_value(value).ok()?;

                Some(navara_layer::LayerDescription::B3dm(Box::new(B3dmLayer {
                    layer_id: layer_id.to_string(),
                    source_id: source_id.clone(),
                    appearances: layer.appearances(old_desc),
                    crs: layer.crs(),
                })))
            }
            "pnts" => {
                let mut layer: PntsLayerDescription = serde_wasm_bindgen::from_value(value).ok()?;

                Some(navara_layer::LayerDescription::Pnts(PntsLayer {
                    layer_id: layer_id.to_string(),
                    source_id: source_id.clone(),
                    appearances: layer.appearances(old_desc),
                    crs: layer.crs(),
                }))
            }
            "mvt" => {
                let mut layer: MvtLayerDescription = serde_wasm_bindgen::from_value(value).ok()?;
                // The legacy `vectorTile` material's `layers` is the sub-layer filter.
                let source_layers = layer.vector_tile.as_ref().and_then(|vt| vt.layers.clone());

                Some(navara_layer::LayerDescription::Mvt(MvtLayer {
                    layer_id: layer_id.to_string(),
                    source_id: source_id.clone(),
                    source_layers,
                    appearances: layer.appearances(old_desc),
                    crs: layer.crs(),
                }))
            }
            "cesium3dtiles" => {
                let mut layer: Cesium3dTilesLayerDescription =
                    serde_wasm_bindgen::from_value(value).ok()?;

                Some(navara_layer::LayerDescription::Cesium3dTiles(
                    Cesium3dTilesLayer {
                        layer_id: layer_id.to_string(),
                        source_id: source_id.clone(),
                        appearances: layer.appearances(old_desc),
                        crs: layer.crs(),
                    },
                ))
            }
            _ => None,
        }
    }
}
