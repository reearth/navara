use navara_ecs::ResolvedRasterTileState;
use wasm_bindgen::prelude::*;

/// One WebMercator raster tile to bake into a layer's drape render target (one per
/// overlapping WM tile per baked layer). `layer_ordinal` pairs the entry with the k-th
/// baked composite slot; `fragment_ind`/`fragment_gen` identify the loaded texture
/// fragment (the web derives its `loadedTexs` key, `${ind}_${gen}`, from them);
/// `uv_offset`/`uv_scale` place this tile into the terrain tile's `[0, 1]` UV for the
/// bake camera; `reproject_terrain_lat` is `[south, north]` (radians) on Geographic
/// terrain (Mercator reprojection) or empty on WebMercator terrain.
#[wasm_bindgen]
pub struct RasterTileState {
    pub layer_ordinal: u32,
    pub fragment_ind: u32,
    pub fragment_gen: u32,
    #[wasm_bindgen(getter_with_clone)]
    pub uv_offset: Vec<f32>,
    #[wasm_bindgen(getter_with_clone)]
    pub uv_scale: Vec<f32>,
    #[wasm_bindgen(getter_with_clone)]
    pub reproject_terrain_lat: Vec<f32>,
}

impl From<ResolvedRasterTileState> for RasterTileState {
    fn from(r: ResolvedRasterTileState) -> Self {
        Self {
            layer_ordinal: r.layer_ordinal as u32,
            fragment_ind: r.fragment.index().index(),
            fragment_gen: r.fragment.generation().to_bits(),
            uv_offset: r.uv_offset.to_vec(),
            uv_scale: r.uv_scale.to_vec(),
            reproject_terrain_lat: r
                .reproject_terrain_lat
                .map(|v| v.to_vec())
                .unwrap_or_default(),
        }
    }
}
