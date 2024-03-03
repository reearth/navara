use serde::Deserialize;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
#[derive(Debug, Clone, Deserialize)]
pub struct LayerDescription {
    #[wasm_bindgen(getter_with_clone)]
    pub r#type: String,
    #[wasm_bindgen(getter_with_clone)]
    pub tile_url: String,
    #[wasm_bindgen(getter_with_clone)]
    pub terrain_url: Option<String>,
    pub z: usize,
    pub segments: usize,
    pub height: f32,
    pub extent: Option<Extent>,
    pub color: u32,
    pub wireframe: bool,
}

#[wasm_bindgen]
#[derive(Debug, Clone, PartialEq, Copy, Deserialize)]
pub struct Extent {
    west: f32,
    south: f32,
    east: f32,
    north: f32,
}

impl LayerDescription {
    pub fn from(value: JsValue) -> Option<Self> {
        serde_wasm_bindgen::from_value(value).ok()
    }

    pub fn to(self) -> Option<map_engine_ecs::map::LayerDescription> {
        match self.r#type.as_str() {
            "tiles" => Some(map_engine_ecs::map::LayerDescription::Tiles {
                tile_url: self.tile_url,
                terrain_url: self.terrain_url,
                z: self.z,
                segments: self.segments,
                height: self.height,
                extent: self.extent.map(|e| e.into()),
                color: self.color,
                wireframe: self.wireframe,
            }),
            _ => None,
        }
    }
}

impl From<Extent> for map_engine_core::Extent<f32, map_engine_core::Radians> {
    fn from(ext: Extent) -> Self {
        map_engine_core::Extent {
            west: map_engine_core::Deg::new(ext.west),
            south: map_engine_core::Deg::new(ext.south),
            east: map_engine_core::Deg::new(ext.east),
            north: map_engine_core::Deg::new(ext.north),
        }
        .into()
    }
}
