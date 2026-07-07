use navara_ecs::ResolvedVectorTileState;
use navara_tile_component::TileHandle;
use wasm_bindgen::prelude::*;

/// One WebMercator texturized-vector tile to drape on a terrain tile (one per
/// overlapping WM vector tile per layer). `uv_offset`/`uv_scale` place this tile's
/// offscreen scene into the terrain tile's `[0, 1]` UV; `reproject_terrain_lat` is
/// `[south, north]` (radians) on Geographic terrain (Mercator reprojection) or empty
/// on WebMercator terrain (identity drape).
#[wasm_bindgen]
pub struct VectorTileState {
    #[wasm_bindgen(getter_with_clone)]
    pub layer_id: String,
    pub tile_handle: TileHandle,
    #[wasm_bindgen(getter_with_clone)]
    pub uv_offset: Vec<f32>,
    #[wasm_bindgen(getter_with_clone)]
    pub uv_scale: Vec<f32>,
    #[wasm_bindgen(getter_with_clone)]
    pub reproject_terrain_lat: Vec<f32>,
}

impl From<ResolvedVectorTileState> for VectorTileState {
    fn from(r: ResolvedVectorTileState) -> Self {
        Self {
            layer_id: r.layer_id,
            tile_handle: r.tile_handle,
            uv_offset: r.uv_offset.to_vec(),
            uv_scale: r.uv_scale.to_vec(),
            reproject_terrain_lat: r
                .reproject_terrain_lat
                .map(|v| v.to_vec())
                .unwrap_or_default(),
        }
    }
}
