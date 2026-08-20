//! Terrain-tile height sampling for `sampleTerrainMostDetailed`.
//!
//! The TypeScript side orchestrates tile fetching (probe from `maxZoom`,
//! concurrency, aborts); these bindings keep every piece of tile math — tile
//! lookup, URL building, decode and interpolation — on the same code paths
//! the engine renders with, so a sampled height matches the rendered surface.
//!
//! Positions cross the boundary as flat `Float64Array`s of `[lng, lat]` pairs
//! in radians; heights come back as one `f64` per pair, in the same order.

use navara_core::{LngLat, Rad, TileXYZ, TilingScheme};
use navara_geometry::{decode_height_from_dem, sample_dem_grid_height, sample_mesh_height};
use navara_math::FloatType;
use navara_wasm_types::ElevationDecoder;
use quantized_mesh::DecodedMesh;
use wasm_bindgen::prelude::*;

const QUANTIZED_MAX: f32 = 32767.0;

fn tiling_scheme(geographic: bool, tms: bool) -> TilingScheme {
    if geographic {
        TilingScheme::Geographic { tms }
    } else {
        TilingScheme::WebMercator { tms }
    }
}

fn positions_from_pairs(
    positions: &[f64],
) -> impl Iterator<Item = LngLat<FloatType, navara_core::Radians>> + '_ {
    positions.chunks_exact(2).map(|p| LngLat {
        lng: Rad::new(p[0]),
        lat: Rad::new(p[1]),
    })
}

/// Tile (x, y) containing each `[lng, lat]` pair at `level`, flattened as
/// `[x0, y0, x1, y1, ...]`. Internal XYZ-style y (north-origin) — the TMS
/// flip happens in URL building, not here.
#[wasm_bindgen(js_name = terrainPositionsToTiles)]
pub fn terrain_positions_to_tiles(geographic: bool, level: u32, positions: &[f64]) -> Vec<u32> {
    let scheme = tiling_scheme(geographic, false);
    let mut tiles = Vec::with_capacity(positions.len());
    for pos in positions_from_pairs(positions) {
        let tile = scheme.position_to_tile_xy(pos, level as usize);
        tiles.push(tile.x as u32);
        tiles.push(tile.y as u32);
    }
    tiles
}

/// Tile URL from the engine's own template expansion, including the TMS
/// y-flip — sampling must fetch exactly the URLs rendering would.
#[wasm_bindgen(js_name = terrainTileUrl)]
pub fn terrain_tile_url(
    template: &str,
    geographic: bool,
    tms: bool,
    x: u32,
    y: u32,
    z: u32,
) -> String {
    tiling_scheme(geographic, tms).tile_url(
        template,
        TileXYZ {
            x: x as usize,
            y: y as usize,
            z: z as usize,
        },
    )
}

/// Heights of a quantized-mesh tile at each `[lng, lat]` pair (radians),
/// interpolated across the decoded mesh's own triangles. Returns `undefined`
/// when the bytes don't decode as quantized-mesh. Positions are expected to
/// lie inside tile (x, y, z); ones outside read the nearest mesh vertex.
#[wasm_bindgen(js_name = sampleQuantizedMeshHeights)]
pub fn sample_quantized_mesh_heights(
    bytes: &[u8],
    geographic: bool,
    x: u32,
    y: u32,
    z: u32,
    positions: &[f64],
) -> Option<Vec<f64>> {
    let decoded = DecodedMesh::decode(bytes).ok()?;

    let min_h = decoded.header.min_height;
    let max_h = decoded.header.max_height;
    let n = decoded.vertices.u.len();
    let mut interleaved = Vec::with_capacity(n * 3);
    for i in 0..n {
        interleaved.push(decoded.vertices.u[i] as f32 / QUANTIZED_MAX);
        interleaved.push(decoded.vertices.v[i] as f32 / QUANTIZED_MAX);
        interleaved
            .push(min_h + (decoded.vertices.height[i] as f32 / QUANTIZED_MAX) * (max_h - min_h));
    }

    let extent = tiling_scheme(geographic, false).tile_extent(TileXYZ {
        x: x as usize,
        y: y as usize,
        z: z as usize,
    });
    Some(sample_uvh_mesh_heights(
        &interleaved,
        &decoded.indices,
        &extent,
        positions,
    ))
}

/// Sample a (u, v, height)-interleaved triangle mesh laid over `extent` at
/// each `[lng, lat]` pair. Quantized-mesh vertices are linear in lng/lat over
/// the tile extent (see `QuantizedMeshData::construct_terrain_mesh`), so the
/// query point maps to (u, v) by plain extent fractions for both schemes.
fn sample_uvh_mesh_heights(
    interleaved: &[f32],
    indices: &[u32],
    extent: &navara_core::Extent<FloatType, navara_core::Radians>,
    positions: &[f64],
) -> Vec<f64> {
    let dist_ew = (extent.east - extent.west).val() as f32;
    let dist_ns = (extent.north - extent.south).val() as f32;

    let mut heights = Vec::with_capacity(positions.len() / 2);
    let mut search_hint = 0usize;
    for pos in positions_from_pairs(positions) {
        if dist_ew == 0.0 || dist_ns == 0.0 || indices.is_empty() {
            heights.push(f64::NAN);
            continue;
        }
        let u = ((pos.lng - extent.west).val() as f32) / dist_ew;
        let v = ((pos.lat - extent.south).val() as f32) / dist_ns;
        heights.push(sample_mesh_height(interleaved, indices, u, v, &mut search_hint) as f64);
    }
    heights
}

/// Heights of a raster-DEM tile (WebMercator, square RGBA image) at each
/// `[lng, lat]` pair (radians), bilinear over the decoded grid. `decoder` is
/// a plain `ElevationDecoder`-shaped object. Returns `undefined` when the
/// decoder doesn't deserialize or the image is empty.
#[wasm_bindgen(js_name = sampleRasterDemHeights)]
pub fn sample_raster_dem_heights(
    rgba: &[u8],
    decoder: JsValue,
    x: u32,
    y: u32,
    z: u32,
    positions: &[f64],
) -> Option<Vec<f64>> {
    let decoder: ElevationDecoder = serde_wasm_bindgen::from_value(decoder).ok()?;
    let heights = decode_dem_grid(rgba, &decoder.into())?;
    // Raster-dem sources are always WebMercator (see `Source::tiling_scheme`).
    let extent = TilingScheme::WebMercator { tms: false }.tile_extent(TileXYZ {
        x: x as usize,
        y: y as usize,
        z: z as usize,
    });

    let mut result = Vec::with_capacity(positions.len() / 2);
    for pos in positions_from_pairs(positions) {
        result.push(sample_dem_grid_height(&extent, &heights, &pos).unwrap_or(f64::NAN));
    }
    Some(result)
}

/// Decode a square RGBA DEM image into the south-row-first f32 grid
/// `sample_dem_grid_height` expects — the same layout
/// `RasterDEMData::compute_height_at_point` builds for the engine.
fn decode_dem_grid(rgba: &[u8], decoder: &navara_core::ElevationDecoder) -> Option<Vec<f32>> {
    let size = ((rgba.len() / 4) as f64).sqrt() as usize;
    if size == 0 {
        return None;
    }
    let mut heights = Vec::with_capacity(size * size);
    for y in (0..size).rev() {
        for x in 0..size {
            let k = (y * size + x) * 4;
            let r = rgba[k] as i64;
            let g = rgba[k + 1] as i64;
            let b = rgba[k + 2] as i64;
            heights.push(decode_height_from_dem(r, g, b, 0., decoder) as f32);
        }
    }
    Some(heights)
}

#[cfg(test)]
mod test {
    use super::*;

    #[test]
    fn positions_to_tiles_matches_tile_extent() {
        // Kariya, Aichi (lng 137.0°, lat 35.0°) on the geographic scheme: the
        // returned tile's extent must contain the position.
        let lng = 137.0_f64.to_radians();
        let lat = 35.0_f64.to_radians();
        let tiles = terrain_positions_to_tiles(true, 14, &[lng, lat]);
        assert_eq!(tiles.len(), 2);
        let extent = TilingScheme::Geographic { tms: false }.tile_extent(TileXYZ {
            x: tiles[0] as usize,
            y: tiles[1] as usize,
            z: 14,
        });
        assert!(extent.west.val() <= lng && lng <= extent.east.val());
        assert!(extent.south.val() <= lat && lat <= extent.north.val());
    }

    #[test]
    fn tile_url_applies_tms_flip() {
        let url = terrain_tile_url("https://t/{z}/{x}/{y}.terrain", true, true, 3, 1, 2);
        // Geographic z=2 has 4 rows; TMS flips y=1 to 2.
        assert_eq!(url, "https://t/2/3/2.terrain");
        let xyz = terrain_tile_url("https://t/{z}/{x}/{y}.terrain", true, false, 3, 1, 2);
        assert_eq!(xyz, "https://t/2/3/1.terrain");
    }

    #[test]
    fn uvh_mesh_sampling_interpolates_inside_the_tile() {
        // Unit-square mesh over a real tile extent, heights 0/10/20/30 at the
        // corners; the tile center reads the mean of a containing triangle.
        let extent =
            TilingScheme::Geographic { tms: false }.tile_extent(TileXYZ { x: 1, y: 0, z: 0 });
        #[rustfmt::skip]
        let interleaved = [
            0.0, 0.0, 0.0,
            1.0, 0.0, 10.0,
            0.0, 1.0, 20.0,
            1.0, 1.0, 30.0,
        ];
        let indices = [0u32, 1, 2, 1, 3, 2];

        let center_lng = (extent.west.val() + extent.east.val()) / 2.0;
        let center_lat = (extent.south.val() + extent.north.val()) / 2.0;
        let west_edge_mid = extent.west.val();

        let heights = sample_uvh_mesh_heights(
            &interleaved,
            &indices,
            &extent,
            &[center_lng, center_lat, west_edge_mid, center_lat],
        );
        assert_eq!(heights.len(), 2);
        // Center (u=v=0.5) lies on the shared diagonal: (10 + 20) / 2.
        assert!((heights[0] - 15.0).abs() < 1e-3, "{}", heights[0]);
        // West edge midpoint (u=0, v=0.5): halfway between 0 and 20.
        assert!((heights[1] - 10.0).abs() < 1e-3, "{}", heights[1]);
    }

    #[test]
    fn dem_grid_decode_flips_rows_south_first() {
        // 2x2 terrarium-encoded image: top row 100m, bottom row 200m. The
        // decoded grid must put the image's bottom row (south) first.
        let decoder = navara_core::TERRARIUM_ELEVATION_DECODER;
        let encode = |h: f64| {
            let v = h - decoder.offset;
            [(v / 256.0) as u8, (v % 256.0) as u8, 0u8, 255u8]
        };
        let mut rgba = Vec::new();
        rgba.extend_from_slice(&encode(100.0));
        rgba.extend_from_slice(&encode(100.0));
        rgba.extend_from_slice(&encode(200.0));
        rgba.extend_from_slice(&encode(200.0));

        let grid = decode_dem_grid(&rgba, &decoder).unwrap();
        assert_eq!(grid.len(), 4);
        assert!((grid[0] - 200.0).abs() < 1e-3, "south row first: {grid:?}");
        assert!((grid[2] - 100.0).abs() < 1e-3, "north row last: {grid:?}");
    }
}
