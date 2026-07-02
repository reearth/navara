//! WASM-facing `Source` description types.
//!
//! These mirror the layer description pattern in [`crate::types`]: each struct
//! derives `wasm_bindgen` + `Deserialize` so wasm-bindgen emits the TypeScript
//! types, and JS passes plain objects that match. [`SourceDescription::to`]
//! dispatches on the `type` tag and converts the deserialized struct into a
//! [`navara_source::Source`].

use navara_core::{CRS, TilingScheme};
use navara_layer::{
    B3dmLayer, Cesium3dTilesLayer, GeoJsonLayer, LayerDescription, MvtLayer, PntsLayer,
    TerrainDataType, TerrainLayer, TilesLayer,
};
use navara_material::{Appearance, ElevationHeatmapConfig, HillshadeConfig};
use navara_parser::geojson::GeoJson;
use navara_source::{
    B3dmSource, GeoJsonData, GeoJsonSource, PntsSource, QuantizedMeshSource, RasterDemSource,
    RasterTileSource, Source, Tiles3dSource, VectorTileSource,
};
use navara_wasm_types::{
    BillboardMaterial, ElevationDecoder, ElevationHeatmapMaterial, HillshadeMaterial,
    ModelMaterial, PointMaterial, PolygonMaterial, PolylineMaterial, RasterMaterial,
    TerrainMaterial, TextMaterial,
};
use serde::Deserialize;
use wasm_bindgen::prelude::*;

use crate::{
    GeoJsonLayerDescription, LayerDescriptionData, LayerDescriptionUrl, MvtLayerDescription,
    TerrainLayerDescription, TileLayerDescription,
};

// Defaults shared by tiled sources.
const DEFAULT_MIN_ZOOM: usize = 0;
const DEFAULT_MAX_ZOOM: usize = 20;
/// Historical default max zoom for quantized-mesh terrain (kept for the legacy API).
const DEFAULT_QUANTIZED_MESH_MAX_ZOOM: usize = 14;
const DEFAULT_OVERSCALED_MAX_ZOOM: usize = 24;
const DEFAULT_TILE_SIZE: u32 = 256;
const DEFAULT_MAX_SSE: f32 = 2.0;

#[wasm_bindgen]
#[derive(Debug, Clone, Deserialize)]
pub struct GeoJsonSourceDescription {
    #[wasm_bindgen(getter_with_clone)]
    pub r#type: Option<String>,
    #[wasm_bindgen(getter_with_clone)]
    pub crs: Option<String>,
    /// URL to fetch the GeoJSON document from. Mutually exclusive with `data`;
    /// like the other sources, the URL is given directly at the top level.
    #[wasm_bindgen(getter_with_clone)]
    pub url: Option<String>,
    /// Inline GeoJSON document (`FeatureCollection` / `Feature` / `Geometry`).
    /// Used when `url` is not given.
    #[wasm_bindgen(getter_with_clone)]
    #[serde(skip_deserializing)]
    pub data: JsValue,
    /// Whether to build a tiled spatial index (GeoJSON-VT) for large datasets.
    pub tiled: Option<bool>,
}

#[wasm_bindgen]
#[derive(Debug, Clone, Deserialize)]
pub struct VectorTileSourceDescription {
    #[wasm_bindgen(getter_with_clone)]
    pub r#type: Option<String>,
    #[wasm_bindgen(getter_with_clone)]
    pub url: Option<String>,
    #[wasm_bindgen(getter_with_clone)]
    pub crs: Option<String>,
    #[wasm_bindgen(js_name = maxZoom)]
    #[serde(rename = "maxZoom")]
    pub max_zoom: Option<usize>,
    #[wasm_bindgen(js_name = overscaledMaxZoom)]
    #[serde(rename = "overscaledMaxZoom")]
    pub overscaled_max_zoom: Option<usize>,
    #[wasm_bindgen(js_name = maxSse)]
    #[serde(rename = "maxSse")]
    pub max_sse: Option<f32>,
}

#[wasm_bindgen]
#[derive(Debug, Clone, Deserialize)]
pub struct RasterTileSourceDescription {
    #[wasm_bindgen(getter_with_clone)]
    pub r#type: Option<String>,
    #[wasm_bindgen(getter_with_clone)]
    pub url: Option<String>,
    pub tms: Option<bool>,
    #[wasm_bindgen(js_name = minZoom)]
    #[serde(rename = "minZoom")]
    pub min_zoom: Option<usize>,
    #[wasm_bindgen(js_name = maxZoom)]
    #[serde(rename = "maxZoom")]
    pub max_zoom: Option<usize>,
    #[wasm_bindgen(js_name = overscaledMaxZoom)]
    #[serde(rename = "overscaledMaxZoom")]
    pub overscaled_max_zoom: Option<usize>,
}

#[wasm_bindgen]
#[derive(Debug, Clone, Deserialize)]
pub struct RasterDemSourceDescription {
    #[wasm_bindgen(getter_with_clone)]
    pub r#type: Option<String>,
    #[wasm_bindgen(getter_with_clone)]
    pub url: Option<String>,
    pub tms: Option<bool>,
    /// How to decode RGB channels into a height value.
    #[wasm_bindgen(js_name = elevationDecoder)]
    #[serde(rename = "elevationDecoder")]
    pub elevation_decoder: Option<ElevationDecoder>,
    #[wasm_bindgen(js_name = tileSize)]
    #[serde(rename = "tileSize")]
    pub tile_size: Option<u32>,
    #[wasm_bindgen(js_name = minZoom)]
    #[serde(rename = "minZoom")]
    pub min_zoom: Option<usize>,
    #[wasm_bindgen(js_name = maxZoom)]
    #[serde(rename = "maxZoom")]
    pub max_zoom: Option<usize>,
    #[wasm_bindgen(js_name = overscaledMaxZoom)]
    #[serde(rename = "overscaledMaxZoom")]
    pub overscaled_max_zoom: Option<usize>,
}

#[wasm_bindgen]
#[derive(Debug, Clone, Deserialize)]
pub struct QuantizedMeshSourceDescription {
    #[wasm_bindgen(getter_with_clone)]
    pub r#type: Option<String>,
    #[wasm_bindgen(getter_with_clone)]
    pub url: Option<String>,
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
    #[wasm_bindgen(js_name = minZoom)]
    #[serde(rename = "minZoom")]
    pub min_zoom: Option<usize>,
    #[wasm_bindgen(js_name = maxZoom)]
    #[serde(rename = "maxZoom")]
    pub max_zoom: Option<usize>,
    #[wasm_bindgen(js_name = overscaledMaxZoom)]
    #[serde(rename = "overscaledMaxZoom")]
    pub overscaled_max_zoom: Option<usize>,
}

#[wasm_bindgen]
#[derive(Debug, Clone, Deserialize)]
pub struct Tiles3dSourceDescription {
    #[wasm_bindgen(getter_with_clone)]
    pub r#type: Option<String>,
    #[wasm_bindgen(getter_with_clone)]
    pub url: Option<String>,
    #[wasm_bindgen(getter_with_clone)]
    pub crs: Option<String>,
}

/// Discriminator used to read the `type` tag (and optional caller-provided `id`)
/// before dispatching.
#[wasm_bindgen]
#[derive(Debug, Clone, Deserialize)]
pub struct SourceDescription {
    #[wasm_bindgen(getter_with_clone)]
    pub r#type: Option<String>,
    /// Optional caller-provided source id. When omitted, a random id is
    /// generated. A duplicate id overrides the existing source (later wins).
    #[wasm_bindgen(getter_with_clone)]
    pub id: Option<String>,
}

/// A `vector` layer references a `geojson` or `vector-tile` source and renders
/// its features with the given per-geometry materials.
#[wasm_bindgen]
#[derive(Debug, Default, Clone, Deserialize)]
pub struct VectorLayerDescription {
    #[wasm_bindgen(getter_with_clone)]
    pub r#type: Option<String>,
    /// The id of the source this layer renders (from `addSource`).
    #[wasm_bindgen(getter_with_clone)]
    pub source: Option<String>,
    /// For vector-tile sources: which source layers within the tileset to
    /// render (MapLibre's `source-layer`). Ignored for GeoJSON sources.
    #[wasm_bindgen(getter_with_clone, js_name = sourceLayers)]
    #[serde(rename = "sourceLayers")]
    pub source_layers: Option<Vec<String>>,
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

/// Merge a partial material update (`$new`) onto the previous internal material
/// (`$old`). This is the single mechanism every layer type uses:
///
/// - `Some(new)` + previous material → `merge` (unset fields keep their value),
/// - `Some(new)` + no previous → the new material's own defaults (`into`),
/// - `None` (update doesn't touch this material) → keep the previous one, or
///   its default when there is none.
///
/// Works for any wasm material with a `merge`/`Into` pair (duck-typed by macro
/// expansion), whether or not it lives inside the [`Appearance`] enum.
macro_rules! merge_material {
    ($new:expr, $old:expr) => {
        match $new {
            Some(new_material) => match $old {
                Some(old_material) => new_material.merge(old_material),
                None => new_material.into(),
            },
            None => $old.cloned().unwrap_or_default(),
        }
    };
}

/// Merge a partial appearance update onto the matching previous appearance of
/// the same [`Appearance`] variant in `$old`, replacing it in `$result`.
/// Delegates the per-material merge to [`merge_material!`].
macro_rules! merge_appearance {
    ($result:expr, $new:expr, $old:expr, $variant:ident) => {
        if let Some(new_material) = $new {
            let old_material = $old.iter().find_map(|a| match a {
                Appearance::$variant(old_material) => Some(old_material),
                _ => None,
            });
            let merged = merge_material!(Some(new_material), old_material);
            $result.retain(|a| !matches!(a, Appearance::$variant(_)));
            $result.push(Appearance::$variant(merged));
        }
    };
}

impl VectorLayerDescription {
    fn appearances(&mut self, old_desc: Option<&LayerDescription>) -> Vec<Appearance> {
        let old = old_desc
            .map(LayerDescription::appearances)
            .unwrap_or_default();
        // Start from the previous appearances so materials this partial update
        // doesn't mention keep their current state.
        let mut result = old.to_vec();
        merge_appearance!(result, self.point.take(), old, Point);
        merge_appearance!(result, self.billboard.take(), old, Billboard);
        merge_appearance!(result, self.text.take(), old, Text);
        merge_appearance!(result, self.polyline.take(), old, Polyline);
        merge_appearance!(result, self.polygon.take(), old, Polygon);
        result
    }

    /// Build the internal layer (`MvtLayer` / `GeoJsonLayer`) by combining this
    /// layer's materials with the referenced source's fetch/tiling config.
    ///
    /// This keeps existing loaders untouched: source fields (url, zoom range,
    /// source layers) are projected onto the legacy layer structs, while only
    /// the rendering materials come from the layer description.
    fn build(
        mut self,
        layer_id: &str,
        source: &Source,
        old_desc: Option<&LayerDescription>,
    ) -> Option<LayerDescription> {
        let source_layers = self.source_layers.take();
        let appearances = self.appearances(old_desc);

        match source {
            Source::VectorTile(vt) => {
                // Vector features render via their own per-geometry materials;
                // the sub-layer filter and traversal/zoom config live on the
                // layer/source.
                Some(LayerDescription::Mvt(MvtLayer {
                    layer_id: layer_id.to_string(),
                    source_id: Some(source.source_id().to_owned()),
                    source_layers,
                    appearances,
                    crs: vt.crs.clone(),
                }))
            }
            Source::GeoJson(gj) => Some(LayerDescription::GeoJson(Box::new(GeoJsonLayer {
                layer_id: layer_id.to_string(),
                source_id: Some(source.source_id().to_owned()),
                appearances,
                crs: gj.crs.clone(),
            }))),
            _ => None,
        }
    }
}

impl Tiles3dLayerDescription {
    /// Merge the partial `model` update onto the previous appearance, so a
    /// payload with only `height` keeps the rest of the material (e.g.
    /// `pointSize`) intact.
    fn appearances(&mut self, old_desc: Option<&LayerDescription>) -> Vec<Appearance> {
        let old = old_desc
            .map(LayerDescription::appearances)
            .unwrap_or_default();
        let mut result = old.to_vec();
        merge_appearance!(result, self.model.take(), old, Model);
        result
    }

    /// Build the internal `3d-tiles` / `b3dm` / `pnts` layer from this layer's
    /// model appearance and the referenced source.
    fn build(
        mut self,
        layer_id: &str,
        source: &Source,
        old_desc: Option<&LayerDescription>,
    ) -> Option<LayerDescription> {
        let appearances = self.appearances(old_desc);

        match source {
            Source::Tiles3d(s) => Some(LayerDescription::Cesium3dTiles(Cesium3dTilesLayer {
                layer_id: layer_id.to_string(),
                source_id: Some(source.source_id().to_owned()),
                appearances,
                crs: s.crs.clone(),
            })),
            Source::B3dm(s) => Some(LayerDescription::B3dm(Box::new(B3dmLayer {
                layer_id: layer_id.to_string(),
                source_id: Some(source.source_id().to_owned()),
                appearances,
                crs: s.crs.clone(),
            }))),
            Source::Pnts(s) => Some(LayerDescription::Pnts(PntsLayer {
                layer_id: layer_id.to_string(),
                source_id: Some(source.source_id().to_owned()),
                appearances,
                crs: s.crs.clone(),
            })),
            _ => None,
        }
    }
}

impl RasterLayerDescription {
    /// Merge the partial `raster` imagery material onto the previous appearance.
    /// The hillshade/heatmap render configs are layer-level (not part of the
    /// `Appearance`), so the builder merges those separately.
    fn appearance(&mut self, old_desc: Option<&LayerDescription>) -> Appearance {
        let old_material = old_desc
            .map(LayerDescription::appearances)
            .unwrap_or_default()
            .iter()
            .find_map(|a| match a {
                Appearance::TerrainTile(m) => Some(m),
                _ => None,
            });
        Appearance::TerrainTile(merge_material!(self.raster.take(), old_material))
    }

    /// Merge the partial `hillshade` update onto the previous config (render
    /// params only; the DEM decoder is read from the source where it's used).
    /// Keeps the previous config when this update doesn't mention hillshade.
    fn hillshade_config(&self, old: Option<&HillshadeConfig>) -> Option<HillshadeConfig> {
        match &self.hillshade {
            Some(h) => Some(HillshadeConfig {
                exaggeration: h
                    .exaggeration
                    .unwrap_or_else(|| old.map_or(1.0, |c| c.exaggeration)),
            }),
            None => old.cloned(),
        }
    }

    /// Merge the partial `elevationHeatmap` update onto the previous config.
    /// Keeps the previous config when this update doesn't mention the heatmap.
    fn heatmap_config(
        &self,
        old: Option<&ElevationHeatmapConfig>,
    ) -> Option<ElevationHeatmapConfig> {
        match &self.elevation_heatmap {
            Some(e) => Some(ElevationHeatmapConfig {
                max_height: e
                    .max_height
                    .unwrap_or_else(|| old.map_or(1000.0, |c| c.max_height)),
                min_height: e
                    .min_height
                    .unwrap_or_else(|| old.map_or(0.0, |c| c.min_height)),
                logarithmic: e
                    .logarithmic
                    .unwrap_or_else(|| old.is_some_and(|c| c.logarithmic)),
                log_boundary: e
                    .log_boundary
                    .unwrap_or_else(|| old.map_or(0.0, |c| c.log_boundary)),
            }),
            None => old.cloned(),
        }
    }

    /// Build the internal `TilesLayer`. The imagery material is merged via
    /// [`Self::appearance`]; the hillshade/heatmap render configs (render params
    /// only — the DEM decoder is read live from the source where it's used) are
    /// merged onto the previous configs so a partial update keeps unset fields.
    fn build(
        mut self,
        layer_id: &str,
        source: &Source,
        old_desc: Option<&LayerDescription>,
    ) -> Option<LayerDescription> {
        // A raster layer must reference an imagery or DEM source.
        match source {
            Source::RasterTile(_) | Source::RasterDem(_) => {}
            _ => return None,
        }

        let (old_hillshade, old_heatmap) = match old_desc {
            Some(LayerDescription::Tiles(l)) => (
                l.hillshade_config.as_ref(),
                l.elevation_heatmap_config.as_ref(),
            ),
            _ => (None, None),
        };

        let hillshade_config = self.hillshade_config(old_hillshade);
        let elevation_heatmap_config = self.heatmap_config(old_heatmap);
        let appearance = self.appearance(old_desc);

        Some(LayerDescription::Tiles(Box::new(TilesLayer {
            layer_id: layer_id.to_string(),
            source_id: Some(source.source_id().to_owned()),
            appearance: Some(appearance),
            elevation_heatmap_config,
            hillshade_config,
        })))
    }
}

impl TerrainSourceLayerDescription {
    /// Merge the partial `terrain` material onto the previous one. Terrain keeps
    /// its material outside the [`Appearance`] enum, so it reads the previous
    /// material directly off the `Terrain` description.
    fn appearance(
        &mut self,
        old_desc: Option<&LayerDescription>,
    ) -> navara_material::TerrainMaterial {
        let old_material = match old_desc {
            Some(LayerDescription::Terrain(l)) => l.appearance.as_ref(),
            _ => None,
        };
        merge_material!(self.terrain.take(), old_material)
    }

    /// Build the internal `TerrainLayer`. The data format is derived from the
    /// source variant; the merged material carries render config only (all
    /// fetch/geometry config is read live from the referenced source).
    fn build(
        mut self,
        layer_id: &str,
        source: &Source,
        old_desc: Option<&LayerDescription>,
    ) -> Option<LayerDescription> {
        let terrain_type = match source {
            Source::RasterDem(_) => TerrainDataType::RasterDEM,
            Source::QuantizedMesh(_) => TerrainDataType::QuantizedMesh,
            _ => return None,
        };

        let appearance = self.appearance(old_desc);

        Some(LayerDescription::Terrain(Box::new(TerrainLayer {
            layer_id: layer_id.to_string(),
            source_id: Some(source.source_id().to_owned()),
            terrain_type,
            appearance: Some(appearance),
        })))
    }
}

fn crs(value: Option<String>) -> Option<CRS> {
    value.map(|c| CRS::from_str(c.as_str()))
}

impl SourceDescription {
    pub fn from(value: JsValue) -> Option<Self> {
        serde_wasm_bindgen::from_value(value).ok()
    }

    pub fn to(source_id: &str, source_type: &str, value: JsValue) -> Option<Source> {
        match source_type {
            "geojson" => {
                let desc: GeoJsonSourceDescription =
                    serde_wasm_bindgen::from_value(value.clone()).ok()?;

                // A top-level `url` takes the URL path; otherwise inline GeoJSON
                // is read from `data` (which serde skips, so re-extract it here).
                let data = if let Some(url) = desc.url.clone() {
                    Some(GeoJsonData::Url(url))
                } else {
                    let js_data: LayerDescriptionData = serde_wasm_bindgen::from_value(value)
                        .unwrap_or_else(|_e| LayerDescriptionData {
                            data: JsValue::NULL,
                        });
                    if !js_data.data.is_null() && !js_data.data.is_undefined() {
                        serde_wasm_bindgen::from_value::<GeoJson>(js_data.data)
                            .ok()
                            .map(GeoJsonData::GeoJson)
                    } else {
                        None
                    }
                };

                Some(Source::GeoJson(GeoJsonSource {
                    source_id: source_id.to_string(),
                    data,
                    crs: crs(desc.crs),
                    tiled: desc.tiled.unwrap_or(false),
                }))
            }
            "vector-tile" => {
                let desc: VectorTileSourceDescription =
                    serde_wasm_bindgen::from_value(value).ok()?;
                Some(Source::VectorTile(VectorTileSource {
                    source_id: source_id.to_string(),
                    url: desc.url?,
                    max_zoom: desc.max_zoom.unwrap_or(DEFAULT_MAX_ZOOM),
                    overscaled_max_zoom: desc
                        .overscaled_max_zoom
                        .unwrap_or(DEFAULT_OVERSCALED_MAX_ZOOM),
                    max_sse: desc.max_sse.unwrap_or(DEFAULT_MAX_SSE),
                    crs: crs(desc.crs),
                }))
            }
            "raster-tile" => {
                let desc: RasterTileSourceDescription =
                    serde_wasm_bindgen::from_value(value).ok()?;
                Some(Source::RasterTile(RasterTileSource {
                    source_id: source_id.to_string(),
                    url: desc.url?,
                    tms: desc.tms.unwrap_or(false),
                    min_zoom: desc.min_zoom.unwrap_or(DEFAULT_MIN_ZOOM),
                    max_zoom: desc.max_zoom.unwrap_or(DEFAULT_MAX_ZOOM),
                    overscaled_max_zoom: desc
                        .overscaled_max_zoom
                        .unwrap_or(DEFAULT_OVERSCALED_MAX_ZOOM),
                }))
            }
            "raster-dem" => {
                let desc: RasterDemSourceDescription =
                    serde_wasm_bindgen::from_value(value).ok()?;
                Some(Source::RasterDem(RasterDemSource {
                    source_id: source_id.to_string(),
                    url: desc.url?,
                    tms: desc.tms.unwrap_or(false),
                    elevation_decoder: desc.elevation_decoder.map(Into::into).unwrap_or_default(),
                    tile_size: desc.tile_size.unwrap_or(DEFAULT_TILE_SIZE),
                    min_zoom: desc.min_zoom.unwrap_or(DEFAULT_MIN_ZOOM),
                    max_zoom: desc.max_zoom.unwrap_or(DEFAULT_MAX_ZOOM),
                    overscaled_max_zoom: desc
                        .overscaled_max_zoom
                        .unwrap_or(DEFAULT_OVERSCALED_MAX_ZOOM),
                }))
            }
            "quantized-mesh" => {
                let desc: QuantizedMeshSourceDescription =
                    serde_wasm_bindgen::from_value(value).ok()?;
                // Cesium quantized-mesh terrain is geographic (EPSG:4326) with a
                // TMS (south-origin) y by default, matching the legacy material.
                let tms = desc.tms.unwrap_or(true);
                let tiling_scheme = if desc.geographic.unwrap_or(true) {
                    TilingScheme::Geographic { tms }
                } else {
                    TilingScheme::WebMercator { tms }
                };
                Some(Source::QuantizedMesh(QuantizedMeshSource {
                    source_id: source_id.to_string(),
                    url: desc.url?,
                    tiling_scheme,
                    request_vertex_normals: desc.request_vertex_normals.unwrap_or(false),
                    request_water_mask: desc.request_water_mask.unwrap_or(false),
                    token: desc.token,
                    min_zoom: desc.min_zoom.unwrap_or(DEFAULT_MIN_ZOOM),
                    max_zoom: desc.max_zoom.unwrap_or(DEFAULT_MAX_ZOOM),
                    overscaled_max_zoom: desc
                        .overscaled_max_zoom
                        .unwrap_or(DEFAULT_OVERSCALED_MAX_ZOOM),
                }))
            }
            "3d-tiles" => {
                let desc: Tiles3dSourceDescription = serde_wasm_bindgen::from_value(value).ok()?;
                Some(Source::Tiles3d(Tiles3dSource {
                    source_id: source_id.to_string(),
                    url: desc.url?,
                    crs: crs(desc.crs),
                }))
            }
            "b3dm" => {
                let desc: Tiles3dSourceDescription = serde_wasm_bindgen::from_value(value).ok()?;
                Some(Source::B3dm(B3dmSource {
                    source_id: source_id.to_string(),
                    url: desc.url?,
                    crs: crs(desc.crs),
                }))
            }
            "pnts" => {
                let desc: Tiles3dSourceDescription = serde_wasm_bindgen::from_value(value).ok()?;
                Some(Source::Pnts(PntsSource {
                    source_id: source_id.to_string(),
                    url: desc.url?,
                    crs: crs(desc.crs),
                }))
            }
            _ => None,
        }
    }
}

/// Minimal view used to read the `source` id from any source-based layer.
#[derive(Deserialize)]
struct SourceRefDescription {
    source: Option<String>,
}

/// Read the referenced source id from a layer description, if present.
pub fn read_source_ref(value: JsValue) -> Option<String> {
    serde_wasm_bindgen::from_value::<SourceRefDescription>(value)
        .ok()
        .and_then(|d| d.source)
}

/// A `raster` layer renders a `raster-tile` (imagery) or `raster-dem` source.
/// For a `raster-dem` source it can additionally render hillshade / elevation
/// heatmap by decoding the same tiles.
#[wasm_bindgen]
#[derive(Debug, Default, Clone, Deserialize)]
pub struct RasterLayerDescription {
    #[wasm_bindgen(getter_with_clone)]
    pub r#type: Option<String>,
    #[wasm_bindgen(getter_with_clone)]
    pub source: Option<String>,
    /// Imagery rendering options for the raster texture. Parallel to `hillshade`
    /// and `elevationHeatmap`; `show`/`color`/etc. apply only to the imagery.
    /// Accepts the legacy `rasterTile` key too so old-API tile layers can still
    /// be updated (extra legacy fields like `maxZoom`/`tms` are ignored here —
    /// they live on the source).
    #[wasm_bindgen(getter_with_clone)]
    #[serde(alias = "rasterTile")] // TODO: Remove with the legacy layer API.
    pub raster: Option<RasterMaterial>,
    #[wasm_bindgen(getter_with_clone)]
    pub hillshade: Option<HillshadeMaterial>,
    #[wasm_bindgen(getter_with_clone, js_name = elevationHeatmap)]
    #[serde(rename = "elevationHeatmap")]
    pub elevation_heatmap: Option<ElevationHeatmapMaterial>,
}

/// A `terrain` layer renders a `raster-dem` or `quantized-mesh`
/// source as the globe surface. Rendering options are uniform regardless of the
/// source's data format.
#[wasm_bindgen]
#[derive(Debug, Default, Clone, Deserialize)]
pub struct TerrainSourceLayerDescription {
    #[wasm_bindgen(getter_with_clone)]
    pub r#type: Option<String>,
    #[wasm_bindgen(getter_with_clone)]
    pub source: Option<String>,
    /// Terrain mesh rendering options. Nested like the other layers' render
    /// inputs (`raster`, `model`, ...); all fetch/geometry config lives on the
    /// referenced source. Accepts the legacy terrain material keys too so
    /// old-API terrain layers can still be updated (extra legacy fetch fields
    /// are ignored — they live on the source).
    #[wasm_bindgen(getter_with_clone)]
    // TODO: Remove with the legacy layer API.
    #[serde(alias = "rasterTerrain", alias = "quantizedMesh", alias = "ellipsoid")]
    pub terrain: Option<TerrainMaterial>,
}

/// A `3d-tiles` layer renders a `3d-tiles` tileset (and the single-content
/// `b3dm` / `pnts` sources) with the given model appearance.
#[wasm_bindgen]
#[derive(Debug, Default, Clone, Deserialize)]
pub struct Tiles3dLayerDescription {
    #[wasm_bindgen(getter_with_clone)]
    pub r#type: Option<String>,
    #[wasm_bindgen(getter_with_clone)]
    pub source: Option<String>,
    #[wasm_bindgen(getter_with_clone)]
    pub model: Option<ModelMaterial>,
}

/// Build the legacy internal layer for a source-based layer type.
///
/// TODO(source-pipeline): This is a shim. It projects the referenced [`Source`]
/// onto the legacy per-layer structs (materials, and the `data` url) at add time.
/// The raster/terrain tile loaders now read the fetch URL from the source via the
/// layer's `source_id` (see `navara_source::SourceStore`), but other fetch config
/// (zoom, tms, decoder) and the vector/3d-tiles loaders still consume the
/// projected struct. As a consequence `updateSource` does not yet propagate to
/// already-created layers.
///
/// `old_desc` is the layer's current description (when updating an existing
/// layer). Partial updates carry only the changed material fields, so it is
/// used to merge those onto the previous appearance instead of resetting the
/// rest to material defaults. Pass `None` when building a brand-new layer.
pub fn build_source_layer(
    layer_id: &str,
    layer_type: &str,
    value: JsValue,
    source: &Source,
    old_desc: Option<&LayerDescription>,
) -> Option<LayerDescription> {
    // Each layer type deserializes into its own description struct, then builds
    // the internal layer via its `build` method (merging onto `old_desc`).
    match layer_type {
        "vector" => from_js::<VectorLayerDescription>(value)?.build(layer_id, source, old_desc),
        "raster" => from_js::<RasterLayerDescription>(value)?.build(layer_id, source, old_desc),
        "terrain" => {
            from_js::<TerrainSourceLayerDescription>(value)?.build(layer_id, source, old_desc)
        }
        "3d-tiles" => from_js::<Tiles3dLayerDescription>(value)?.build(layer_id, source, old_desc),
        _ => None,
    }
}

/// Deserialize a JS value into a layer description, returning `None` on error.
fn from_js<T: serde::de::DeserializeOwned>(value: JsValue) -> Option<T> {
    serde_wasm_bindgen::from_value(value).ok()
}

/// TODO: Remove when all add_layer uses `source`.
/// Build an implicit [`Source`] for a legacy (old-API) layer description, so the
/// loaders can resolve its URL through `SourceStore` like new-API layers.
/// Returns `None` for geojson (handled by its inline data path) and for
/// descriptions without a usable URL.
///
/// All fetch fields (url, zoom range, tms, decoder, tiling scheme, token, ...)
/// are extracted from the legacy material onto the implicit source, since the
/// loaders read them live from the source (the render material no longer carries
/// them).
pub fn legacy_source(source_id: &str, layer_type: &str, value: JsValue) -> Option<Source> {
    let url = legacy_data_url(value.clone());
    match layer_type {
        "tiles" => {
            // Carry the real tiling/zoom config from the legacy `rasterTile`
            // material onto the implicit source (the render material drops them).
            let layer: TileLayerDescription = serde_wasm_bindgen::from_value(value).ok()?;
            let rt = layer.raster_tile.as_ref();
            let url = url?;
            let tms = rt.and_then(|m| m.tms).unwrap_or(false);
            let min_zoom = rt.and_then(|m| m.min_zoom).unwrap_or(DEFAULT_MIN_ZOOM);
            let max_zoom = rt.and_then(|m| m.max_zoom).unwrap_or(DEFAULT_MAX_ZOOM);
            let overscaled_max_zoom = rt
                .and_then(|m| m.overscaled_max_zoom)
                .unwrap_or(DEFAULT_OVERSCALED_MAX_ZOOM);

            // A hillshade / elevation-heatmap tiles layer decodes DEM tiles, so it
            // needs a `raster-dem` source carrying the elevation decoder (mirrors
            // the new API, where such raster layers reference a raster-dem
            // source). Plain imagery uses a `raster-tile` source.
            let decoder = layer
                .hillshade
                .as_ref()
                .and_then(|h| h.elevation_decoder)
                .or_else(|| {
                    layer
                        .elevation_heatmap
                        .as_ref()
                        .and_then(|e| e.elevation_decoder)
                });
            if let Some(decoder) = decoder {
                Some(Source::RasterDem(RasterDemSource {
                    source_id: source_id.to_owned(),
                    url,
                    tms,
                    elevation_decoder: decoder.into(),
                    tile_size: DEFAULT_TILE_SIZE,
                    min_zoom,
                    max_zoom,
                    overscaled_max_zoom,
                }))
            } else {
                Some(Source::RasterTile(RasterTileSource {
                    source_id: source_id.to_owned(),
                    url,
                    tms,
                    min_zoom,
                    max_zoom,
                    overscaled_max_zoom,
                }))
            }
        }
        "terrain" => {
            // Carry the real fetch config from the legacy terrain material (the
            // raw wasm description, which still has these fields) onto the
            // implicit source. The render material drops them.
            let layer: TerrainLayerDescription = serde_wasm_bindgen::from_value(value).ok()?;
            if let Some(m) = layer.raster_terrain {
                Some(Source::RasterDem(RasterDemSource {
                    source_id: source_id.to_owned(),
                    url: url?,
                    tms: false,
                    elevation_decoder: m.elevation_decoder.map(Into::into).unwrap_or_default(),
                    tile_size: m.tile_size.unwrap_or(DEFAULT_TILE_SIZE),
                    min_zoom: m.min_zoom.unwrap_or(DEFAULT_MIN_ZOOM),
                    max_zoom: m.max_zoom.unwrap_or(DEFAULT_MAX_ZOOM),
                    overscaled_max_zoom: m
                        .overscaled_max_zoom
                        .unwrap_or(DEFAULT_OVERSCALED_MAX_ZOOM),
                }))
            } else if let Some(m) = layer.quantized_mesh {
                // Historical quantized-mesh defaults: Geographic { tms: true }, max_zoom 14.
                let tms = m.tms.unwrap_or(true);
                let geographic = m.geographic.unwrap_or(true);
                let tiling_scheme = if geographic {
                    TilingScheme::Geographic { tms }
                } else {
                    TilingScheme::WebMercator { tms }
                };
                Some(Source::QuantizedMesh(QuantizedMeshSource {
                    source_id: source_id.to_owned(),
                    url: url?,
                    tiling_scheme,
                    request_vertex_normals: m.request_vertex_normals.unwrap_or(false),
                    request_water_mask: m.request_water_mask.unwrap_or(false),
                    token: m.token,
                    min_zoom: m.min_zoom.unwrap_or(DEFAULT_MIN_ZOOM),
                    max_zoom: m.max_zoom.unwrap_or(DEFAULT_QUANTIZED_MESH_MAX_ZOOM),
                    overscaled_max_zoom: m
                        .overscaled_max_zoom
                        .unwrap_or(DEFAULT_OVERSCALED_MAX_ZOOM),
                }))
            } else {
                // Ellipsoid terrain is layer-only (render settings, no data), so
                // it needs no source.
                None
            }
        }
        "mvt" => {
            // Carry the real zoom/sse traversal config from the legacy
            // `vectorTile` material onto the implicit source.
            let layer: MvtLayerDescription = serde_wasm_bindgen::from_value(value).ok()?;
            let vt = layer.vector_tile.as_ref();
            Some(Source::VectorTile(VectorTileSource {
                source_id: source_id.to_owned(),
                url: url?,
                max_zoom: vt.and_then(|m| m.max_zoom).unwrap_or(DEFAULT_MAX_ZOOM),
                overscaled_max_zoom: vt
                    .and_then(|m| m.overscaled_max_zoom)
                    .unwrap_or(DEFAULT_OVERSCALED_MAX_ZOOM),
                max_sse: vt.and_then(|m| m.max_sse).unwrap_or(DEFAULT_MAX_SSE),
                crs: None,
            }))
        }
        "cesium3dtiles" => Some(Source::Tiles3d(Tiles3dSource {
            source_id: source_id.to_owned(),
            url: url?,
            crs: None,
        })),
        "b3dm" => Some(Source::B3dm(B3dmSource {
            source_id: source_id.to_owned(),
            url: url?,
            crs: None,
        })),
        "pnts" => Some(Source::Pnts(PntsSource {
            source_id: source_id.to_owned(),
            url: url?,
            crs: None,
        })),
        "geojson" => {
            // GeoJSON data is inline JSON or a URL; either way it becomes the
            // implicit source's data (the layer reads it live from the source).
            let data = legacy_geojson_data(value.clone())?;
            let crs = serde_wasm_bindgen::from_value::<GeoJsonLayerDescription>(value)
                .ok()
                .and_then(|l| l.crs());
            Some(Source::GeoJson(GeoJsonSource {
                source_id: source_id.to_owned(),
                data: Some(data),
                crs,
                tiled: false,
            }))
        }
        _ => None,
    }
}

/// Parse a legacy geojson layer description's `data` field into [`GeoJsonData`]
/// (a URL string or inline GeoJSON document), mirroring [`LayerDescription::to`].
///
/// TODO: Remove with the legacy layer API.
fn legacy_geojson_data(value: JsValue) -> Option<GeoJsonData> {
    let js_data: LayerDescriptionData =
        serde_wasm_bindgen::from_value(value).unwrap_or(LayerDescriptionData {
            data: JsValue::NULL,
        });
    if js_data.data.is_null() || js_data.data.is_undefined() {
        return None;
    }
    // A `{ url }` object denotes a URL source; otherwise treat it as inline GeoJSON.
    if let Ok(url) = serde_wasm_bindgen::from_value::<LayerDescriptionUrl>(js_data.data.clone()) {
        Some(GeoJsonData::Url(url.url))
    } else {
        let geojson: GeoJson = serde_wasm_bindgen::from_value(js_data.data).ok()?;
        Some(GeoJsonData::GeoJson(geojson))
    }
}

/// Extract the tile URL template from a legacy layer description's `data` field,
/// mirroring how [`LayerDescription::to`] reads it.
///
/// TODO: Remove with the legacy layer API.
fn legacy_data_url(value: JsValue) -> Option<String> {
    let js_data: LayerDescriptionData =
        serde_wasm_bindgen::from_value(value).unwrap_or(LayerDescriptionData {
            data: JsValue::NULL,
        });
    if js_data.data.is_null() || js_data.data.is_undefined() {
        return None;
    }
    let url: LayerDescriptionUrl = serde_wasm_bindgen::from_value(js_data.data).ok()?;
    Some(url.url)
}

#[cfg(test)]
mod tests {
    use super::*;
    use navara_layer::{GeoJsonLayer, PntsLayer};

    fn pnts_desc(appearances: Vec<Appearance>) -> LayerDescription {
        LayerDescription::Pnts(PntsLayer {
            layer_id: "layer".into(),
            source_id: Some("source".into()),
            appearances,
            crs: None,
        })
    }

    fn geojson_desc(appearances: Vec<Appearance>) -> LayerDescription {
        LayerDescription::GeoJson(Box::new(GeoJsonLayer {
            layer_id: "layer".into(),
            source_id: Some("source".into()),
            appearances,
            crs: None,
        }))
    }

    fn tiles3d_desc(model: Option<ModelMaterial>) -> Tiles3dLayerDescription {
        Tiles3dLayerDescription {
            model,
            ..Default::default()
        }
    }

    fn only_model(appearances: &[Appearance]) -> &navara_material::ModelMaterial {
        match appearances {
            [Appearance::Model(m)] => m,
            _ => panic!("expected exactly one model appearance, got {appearances:?}"),
        }
    }

    fn find_point(appearances: &[Appearance]) -> &navara_material::PointMaterial {
        appearances
            .iter()
            .find_map(|a| match a {
                Appearance::Point(m) => Some(m),
                _ => None,
            })
            .expect("expected a point appearance")
    }

    // The reported bug: change point size, then height. The height-only update
    // must not reset the previously-set point size back to its default.
    #[test]
    fn tiles3d_height_update_keeps_previous_point_size() {
        let old = pnts_desc(vec![Appearance::Model(navara_material::ModelMaterial {
            point_size: 5.0,
            height: 0.0,
            ..Default::default()
        })]);
        let update: ModelMaterial = serde_json::from_str(r#"{"height": 10.0}"#).unwrap();

        let result = tiles3d_desc(Some(update)).appearances(Some(&old));

        let model = only_model(&result);
        assert_eq!(
            model.point_size, 5.0,
            "point size must survive a height-only update"
        );
        assert_eq!(model.height, 10.0);
    }

    // Adding a brand-new layer (no previous state) fills unset fields from the
    // material defaults.
    #[test]
    fn tiles3d_without_previous_uses_defaults() {
        let update: ModelMaterial = serde_json::from_str(r#"{"height": 10.0}"#).unwrap();

        let result = tiles3d_desc(Some(update)).appearances(None);

        let model = only_model(&result);
        assert_eq!(model.height, 10.0);
        assert_eq!(
            model.point_size,
            navara_material::ModelMaterial::default().point_size
        );
    }

    // A partial update that doesn't mention `model` at all keeps the previous
    // appearance instead of clearing it.
    #[test]
    fn tiles3d_without_model_keeps_previous() {
        let old = pnts_desc(vec![Appearance::Model(navara_material::ModelMaterial {
            point_size: 5.0,
            ..Default::default()
        })]);

        let result = tiles3d_desc(None).appearances(Some(&old));

        assert_eq!(only_model(&result).point_size, 5.0);
    }

    // Vector layers merge the touched material and preserve the other
    // per-geometry appearances the update didn't mention.
    #[test]
    fn vector_update_merges_point_and_keeps_other_appearances() {
        let old = geojson_desc(vec![
            Appearance::Point(navara_material::PointMaterial {
                size: 5.0,
                color: 0xff0000,
                ..Default::default()
            }),
            Appearance::Polygon(navara_material::PolygonMaterial::default()),
        ]);
        let mut desc = VectorLayerDescription {
            point: Some(serde_json::from_str(r#"{"color": 255}"#).unwrap()),
            ..Default::default()
        };

        let result = desc.appearances(Some(&old));

        let point = find_point(&result);
        assert_eq!(point.size, 5.0, "size preserved by a color-only update");
        assert_eq!(point.color, 255, "color updated");
        assert!(
            result.iter().any(|a| matches!(a, Appearance::Polygon(_))),
            "unrelated polygon appearance must be kept"
        );
        assert_eq!(result.len(), 2, "no duplicate appearances");
    }

    #[test]
    fn vector_without_previous_builds_from_payload() {
        let mut desc = VectorLayerDescription {
            point: Some(serde_json::from_str(r#"{"size": 3.0}"#).unwrap()),
            ..Default::default()
        };

        let result = desc.appearances(None);

        let point = find_point(&result);
        assert_eq!(point.size, 3.0);
        assert_eq!(
            point.color,
            navara_material::PointMaterial::default().color,
            "unset fields fall back to defaults"
        );
        assert_eq!(result.len(), 1);
    }

    fn raster_material(appearance: &Appearance) -> &navara_material::RasterMaterial {
        match appearance {
            Appearance::TerrainTile(m) => m,
            _ => panic!("expected a raster (terrain tile) appearance, got {appearance:?}"),
        }
    }

    fn raster_desc(material: navara_material::RasterMaterial) -> LayerDescription {
        LayerDescription::Tiles(Box::new(TilesLayer {
            layer_id: "layer".into(),
            source_id: Some("source".into()),
            appearance: Some(Appearance::TerrainTile(material)),
            elevation_heatmap_config: None,
            hillshade_config: None,
        }))
    }

    fn terrain_desc(material: navara_material::TerrainMaterial) -> LayerDescription {
        LayerDescription::Terrain(Box::new(TerrainLayer {
            layer_id: "layer".into(),
            source_id: Some("source".into()),
            terrain_type: TerrainDataType::RasterDEM,
            appearance: Some(material),
        }))
    }

    #[test]
    fn raster_update_preserves_untouched_fields() {
        let old = raster_desc(navara_material::RasterMaterial {
            opacity: 0.5,
            color: 0xff0000,
            ..Default::default()
        });
        let mut desc = RasterLayerDescription {
            raster: Some(serde_json::from_str(r#"{"color": 255}"#).unwrap()),
            ..Default::default()
        };

        let appearance = desc.appearance(Some(&old));

        let merged = raster_material(&appearance);
        assert_eq!(
            merged.opacity, 0.5,
            "opacity preserved by a color-only update"
        );
        assert_eq!(merged.color, 255);
    }

    #[test]
    fn raster_without_update_keeps_previous_material() {
        let old = raster_desc(navara_material::RasterMaterial {
            opacity: 0.5,
            ..Default::default()
        });
        let mut desc = RasterLayerDescription::default();

        let appearance = desc.appearance(Some(&old));

        assert_eq!(raster_material(&appearance).opacity, 0.5);
    }

    #[test]
    fn terrain_update_preserves_untouched_fields() {
        let old = terrain_desc(navara_material::TerrainMaterial {
            skirt: true,
            skirt_exaggeration: 2.0,
            ..Default::default()
        });
        let mut desc = TerrainSourceLayerDescription {
            terrain: Some(serde_json::from_str(r#"{"skirtExaggeration": 5.0}"#).unwrap()),
            ..Default::default()
        };

        let merged = desc.appearance(Some(&old));

        assert!(
            merged.skirt,
            "skirt flag preserved by an exaggeration-only update"
        );
        assert_eq!(merged.skirt_exaggeration, 5.0);
    }

    #[test]
    fn raster_heatmap_update_preserves_untouched_fields() {
        let old = navara_material::ElevationHeatmapConfig {
            max_height: 500.0,
            min_height: 10.0,
            logarithmic: true,
            log_boundary: 5.0,
        };
        let desc = RasterLayerDescription {
            elevation_heatmap: Some(serde_json::from_str(r#"{"maxHeight": 999.0}"#).unwrap()),
            ..Default::default()
        };

        let merged = desc.heatmap_config(Some(&old)).expect("heatmap config");

        assert_eq!(merged.max_height, 999.0, "max_height updated");
        assert_eq!(merged.min_height, 10.0, "min_height preserved");
        assert!(merged.logarithmic, "logarithmic preserved");
        assert_eq!(merged.log_boundary, 5.0, "log_boundary preserved");
    }

    #[test]
    fn raster_without_heatmap_keeps_previous_config() {
        let old = navara_material::ElevationHeatmapConfig {
            max_height: 500.0,
            min_height: 10.0,
            logarithmic: true,
            log_boundary: 5.0,
        };
        let desc = RasterLayerDescription::default();

        assert_eq!(desc.heatmap_config(Some(&old)), Some(old));
    }

    #[test]
    fn raster_hillshade_empty_update_keeps_exaggeration() {
        let old = navara_material::HillshadeConfig { exaggeration: 2.0 };
        // Hillshade present in the update but with no fields set.
        let desc = RasterLayerDescription {
            hillshade: Some(serde_json::from_str(r#"{}"#).unwrap()),
            ..Default::default()
        };

        let merged = desc.hillshade_config(Some(&old)).expect("hillshade config");

        assert_eq!(
            merged.exaggeration, 2.0,
            "an empty hillshade update keeps the previous exaggeration"
        );
    }

    #[test]
    fn raster_hillshade_update_sets_exaggeration() {
        let old = navara_material::HillshadeConfig { exaggeration: 2.0 };
        let desc = RasterLayerDescription {
            hillshade: Some(serde_json::from_str(r#"{"exaggeration": 3.5}"#).unwrap()),
            ..Default::default()
        };

        let merged = desc.hillshade_config(Some(&old)).expect("hillshade config");

        assert_eq!(merged.exaggeration, 3.5);
    }
}
