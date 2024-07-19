use navara_layer::{TerrainDataType, TerrainLayer, TilesLayer};
use serde::Deserialize;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
#[derive(Debug, Clone, Deserialize)]
pub struct TileLayerDescription {
    #[wasm_bindgen(getter_with_clone)]
    pub r#type: String,
    #[wasm_bindgen(getter_with_clone)]
    pub url: String,
    pub segments: usize,
    pub color: u32,
    pub max_sse: Option<f32>,
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
    pub wireframe: bool,
    /// This is required in `terrain layer`
    pub elevation_decoder: Option<ElevationDecoder>,
}

#[wasm_bindgen]
#[derive(Debug, Clone, Deserialize)]
pub struct LayerDescription {
    #[wasm_bindgen(getter_with_clone)]
    pub r#type: String,
}

#[wasm_bindgen]
#[derive(Debug, Clone, PartialEq, Default, Copy, Deserialize)]
pub struct ElevationDecoder {
    pub r_scaler: f32,
    pub g_scaler: f32,
    pub b_scaler: f32,
    pub offset: f32,
    pub max_offset: f32,
    pub min_offset: f32,
    pub boundary: f32,
    pub epsilon: f32,
}

impl LayerDescription {
    pub fn from(value: JsValue) -> Option<Self> {
        serde_wasm_bindgen::from_value(value).ok()
    }

    pub fn to(self, value: JsValue) -> Option<navara_layer::LayerDescription> {
        match self.r#type.as_str() {
            "tiles" => {
                let layer: TileLayerDescription = serde_wasm_bindgen::from_value(value).ok()?;
                Some(navara_layer::LayerDescription::Tiles(TilesLayer {
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
                    url: layer.url.clone(),
                    segments: layer.segments,
                    max_z: layer.max_z,
                    wireframe: layer.wireframe,
                    elevation_decoder: layer.elevation_decoder.unwrap_or_default().into(),
                    terrain_type: TerrainDataType::from_url(&layer.url),
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
