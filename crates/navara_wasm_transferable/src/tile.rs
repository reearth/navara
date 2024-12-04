use navara_math::FloatType;
use navara_tile_component::RasterTile;
use navara_wasm_types::{CachedMeshHandle, TileXYZ};
use wasm_bindgen::prelude::wasm_bindgen;

#[wasm_bindgen]
pub struct TransferableTile {
    pub coords: TileXYZ,
    pub max_height: FloatType,
    #[wasm_bindgen(getter_with_clone)]
    pub cached_mesh_handle: Option<CachedMeshHandle>,
}

#[wasm_bindgen]
impl TransferableTile {
    #[wasm_bindgen(constructor)]
    pub fn new(
        coords: TileXYZ,
        max_height: FloatType,
        cached_mesh_handle: Option<CachedMeshHandle>,
    ) -> Self {
        Self {
            coords,
            max_height,
            cached_mesh_handle,
        }
    }
}

impl<'a> From<&'a RasterTile> for TransferableTile {
    fn from(value: &'a RasterTile) -> Self {
        Self {
            coords: value.coords.into(),
            max_height: value.max_height,
            cached_mesh_handle: value.cached_mesh_handle.clone().map(|v| v.into()),
        }
    }
}

impl From<TransferableTile> for RasterTile {
    fn from(value: TransferableTile) -> Self {
        let mut t = Self::new(value.coords.into(), value.max_height);
        t.cached_mesh_handle = value.cached_mesh_handle.map(|v| v.into());
        t
    }
}
