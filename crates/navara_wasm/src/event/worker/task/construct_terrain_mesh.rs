use navara_buffer_store::Handle;
use navara_math::FloatType;
use navara_tile_component::TileHandle;
use serde::Serialize;
use wasm_bindgen::prelude::*;

use crate::geometry::TransferableGeometry;

#[wasm_bindgen]
#[derive(Clone, Debug, Serialize)]
pub struct ConstructTerrainMeshParameters {
    #[wasm_bindgen(getter_with_clone)]
    pub tile_size: u32,
    pub bytes_handle: Handle,
    pub tile_handle: TileHandle,
}

impl<'a> From<&'a navara_worker::construct_terrain_mesh::ConstructTerrainMeshParameters>
    for ConstructTerrainMeshParameters
{
    fn from(
        val: &'a navara_worker::construct_terrain_mesh::ConstructTerrainMeshParameters,
    ) -> ConstructTerrainMeshParameters {
        ConstructTerrainMeshParameters {
            tile_size: val.tile_size,
            bytes_handle: val.bytes_handle,
            tile_handle: val.tile_handle,
        }
    }
}

#[wasm_bindgen]
#[derive(Clone, Debug, Serialize)]
pub struct ConstructTerrainMeshResult {
    #[wasm_bindgen(getter_with_clone)]
    pub geometry: TransferableGeometry,
    pub heights: Handle,
    pub min_height: FloatType,
    pub max_height: FloatType,
}

#[wasm_bindgen]
impl ConstructTerrainMeshResult {
    #[wasm_bindgen(constructor)]
    pub fn new(
        geometry: TransferableGeometry,
        heights: Handle,
        min_height: FloatType,
        max_height: FloatType,
    ) -> Self {
        Self {
            geometry,
            heights,
            min_height,
            max_height,
        }
    }
}

impl From<ConstructTerrainMeshResult>
    for navara_worker::construct_terrain_mesh::ConstructTerrainMeshResult
{
    fn from(val: ConstructTerrainMeshResult) -> Self {
        navara_worker::construct_terrain_mesh::ConstructTerrainMeshResult {
            geometry: val.geometry.into(),
            heights: val.heights,
            min_height: val.min_height,
            max_height: val.max_height,
        }
    }
}
impl<'a> From<&'a navara_worker::construct_terrain_mesh::ConstructTerrainMeshResult>
    for ConstructTerrainMeshResult
{
    fn from(
        val: &'a navara_worker::construct_terrain_mesh::ConstructTerrainMeshResult,
    ) -> ConstructTerrainMeshResult {
        ConstructTerrainMeshResult {
            geometry: (&val.geometry).into(),
            heights: val.heights,
            min_height: val.min_height,
            max_height: val.max_height,
        }
    }
}
