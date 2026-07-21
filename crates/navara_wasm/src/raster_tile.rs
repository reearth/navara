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

/// WebMercator northing `ln(tan(lat/2 + π/4))` for a latitude in radians,
/// clamped to the valid WebMercator band (~±85.05°).
///
/// Exported so the web composite paste (`mutates.ts`) derives its per-slot
/// reprojection constants from the same clamped math the Rust bake affine uses
/// (`uv_rect_from_extents_mercator`) — the two sides must agree or the pasted
/// latitude band drifts off the baked render target. A TS reimplementation
/// also returned NaN for the unclamped polar band (±90° as f32), which
/// silently disabled reprojection via the shader's span guard.
#[wasm_bindgen(js_name = "mercatorY")]
pub fn mercator_y(lat: f64) -> f64 {
    navara_geometry::mercator_y(lat)
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
