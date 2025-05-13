use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::wasm_bindgen;

#[wasm_bindgen]
#[derive(Debug, Clone, PartialEq, Default, Copy, Deserialize)]
pub struct TileXYZ {
    pub x: usize,
    pub y: usize,
    pub z: usize,
}

#[wasm_bindgen]
impl TileXYZ {
    #[wasm_bindgen(constructor)]
    pub fn new(x: usize, y: usize, z: usize) -> Self {
        Self { x, y, z }
    }
}

impl From<navara_core::TileXYZ> for TileXYZ {
    fn from(d: navara_core::TileXYZ) -> Self {
        TileXYZ {
            x: d.x,
            y: d.y,
            z: d.z,
        }
    }
}

impl From<TileXYZ> for navara_core::TileXYZ {
    fn from(d: TileXYZ) -> Self {
        Self {
            x: d.x,
            y: d.y,
            z: d.z,
        }
    }
}

#[wasm_bindgen]
#[derive(Debug, Clone, PartialEq, Default, Copy, Serialize)]
pub struct TileCoordinates {
    pub x: usize,
    pub y: usize,
    pub z: usize,
    pub overscaled: usize,
}

impl From<&navara_tile_component::TileCoordinates> for TileCoordinates {
    fn from(d: &navara_tile_component::TileCoordinates) -> Self {
        TileCoordinates {
            x: d.x,
            y: d.y,
            z: d.z,
            overscaled: d.overscaled,
        }
    }
}
