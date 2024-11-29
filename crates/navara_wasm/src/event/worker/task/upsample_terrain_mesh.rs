use navara_buffer_store::Handle;
use navara_math::FloatType;
use navara_tile_component::TileHandle;
use serde::Serialize;
use wasm_bindgen::prelude::*;

use crate::geometry::TransferableGeometry;

#[wasm_bindgen]
#[derive(Clone, Debug, Serialize)]
pub struct UpsampleTerrainMeshParameters {
    #[wasm_bindgen(getter_with_clone)]
    pub tile_handle: TileHandle,
}

#[wasm_bindgen]
impl UpsampleTerrainMeshParameters {
    #[wasm_bindgen(constructor)]
    pub fn new(tile_handle: TileHandle) -> Self {
        Self { tile_handle }
    }
}

impl<'a> From<&'a navara_worker::upsample_terrain_mesh::UpsampleTerrainMeshParameters>
    for UpsampleTerrainMeshParameters
{
    fn from(
        val: &'a navara_worker::upsample_terrain_mesh::UpsampleTerrainMeshParameters,
    ) -> UpsampleTerrainMeshParameters {
        UpsampleTerrainMeshParameters {
            tile_handle: val.tile_handle,
        }
    }
}

#[wasm_bindgen]
#[derive(Clone, Debug, Serialize)]
pub struct UpsampleTerrainMeshResult {
    #[wasm_bindgen(getter_with_clone)]
    pub geometry: TransferableGeometry,
    pub heights: Handle,
    pub min_height: FloatType,
    pub max_height: FloatType,
}

#[wasm_bindgen]
impl UpsampleTerrainMeshResult {
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

impl From<UpsampleTerrainMeshResult>
    for navara_worker::upsample_terrain_mesh::UpsampleTerrainMeshResult
{
    fn from(val: UpsampleTerrainMeshResult) -> Self {
        navara_worker::upsample_terrain_mesh::UpsampleTerrainMeshResult {
            geometry: val.geometry.into(),
            heights: val.heights,
            min_height: val.min_height,
            max_height: val.max_height,
        }
    }
}
impl<'a> From<&'a navara_worker::upsample_terrain_mesh::UpsampleTerrainMeshResult>
    for UpsampleTerrainMeshResult
{
    fn from(
        val: &'a navara_worker::upsample_terrain_mesh::UpsampleTerrainMeshResult,
    ) -> UpsampleTerrainMeshResult {
        UpsampleTerrainMeshResult {
            geometry: (&val.geometry).into(),
            heights: val.heights,
            min_height: val.min_height,
            max_height: val.max_height,
        }
    }
}
