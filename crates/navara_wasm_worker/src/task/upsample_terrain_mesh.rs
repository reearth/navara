use navara_core::{TilingScheme, WGS84_64};
use navara_geometry::calculate_skirt_height;
use navara_tile_component::{QuantizedMeshData, RasterDEMData, RasterTile};
use navara_wasm_transferable::{TransferableRasterDEMData, TransferableTile};
use navara_wasm_types::{ReturnedConstructedTerrainMesh, UpsamplableTerrainGeometry};
use wasm_bindgen::prelude::wasm_bindgen;

#[wasm_bindgen(js_name = upsampleTerrainMesh)]
pub fn upsample_terrain_mesh(
    tile: TransferableTile,
    parent_tile: TransferableTile,
    raster_dem_data: TransferableRasterDEMData,
    upsamplable_geometry: UpsamplableTerrainGeometry,
    skirt: bool,
    skirt_exaggeration: f32,
) -> ReturnedConstructedTerrainMesh {
    let raster_dem_data: RasterDEMData = raster_dem_data.into();

    let mut tile: RasterTile = tile.into();
    tile.terrain_data = Some(Box::new(raster_dem_data.clone()));
    let mut parent_tile: RasterTile = parent_tile.into();
    parent_tile.terrain_data = Some(Box::new(raster_dem_data));

    let upsamplable_geometry: navara_geometry::UpsamplableTerrainGeometry =
        (&upsamplable_geometry).into();

    let mut result = tile
        .upsample(WGS84_64, &parent_tile, upsamplable_geometry)
        .unwrap();

    if skirt {
        let skirt_height = calculate_skirt_height(&WGS84_64, tile.coords.z, skirt_exaggeration);
        let down_dir_fn = navara_geometry::make_wgs84_down_dir_fn(WGS84_64, result.rtc_translation);
        navara_geometry::add_skirt_separate(&mut result.geometry, skirt_height, &down_dir_fn);
    }

    result.into()
}

#[wasm_bindgen(js_name = upsampleQuantizedMeshTerrainMesh)]
pub fn upsample_quantized_mesh_terrain_mesh(
    tile: TransferableTile,
    parent_tile: TransferableTile,
    upsamplable_geometry: UpsamplableTerrainGeometry,
    skirt: bool,
    skirt_exaggeration: f32,
    geographic: bool,
    tms: bool,
) -> ReturnedConstructedTerrainMesh {
    let tiling_scheme = if geographic {
        TilingScheme::Geographic { tms }
    } else {
        TilingScheme::WebMercator { tms }
    };
    let mut tile: RasterTile = tile.into();
    tile.extent = tiling_scheme.tile_extent(tile.coords);
    tile.terrain_data = Some(Box::new(QuantizedMeshData::new_with_tiling_scheme(
        tiling_scheme.clone(),
    )));
    let mut parent_tile: RasterTile = parent_tile.into();
    parent_tile.extent = tiling_scheme.tile_extent(parent_tile.coords);
    parent_tile.terrain_data = Some(Box::new(QuantizedMeshData::new_with_tiling_scheme(
        tiling_scheme,
    )));

    let upsamplable_geometry: navara_geometry::UpsamplableTerrainGeometry =
        (&upsamplable_geometry).into();

    let mut result = tile
        .upsample(WGS84_64, &parent_tile, upsamplable_geometry)
        .unwrap();

    if skirt {
        let skirt_height = calculate_skirt_height(&WGS84_64, tile.coords.z, skirt_exaggeration);
        let down_dir_fn = navara_geometry::make_wgs84_down_dir_fn(WGS84_64, result.rtc_translation);
        navara_geometry::add_skirt_separate(&mut result.geometry, skirt_height, &down_dir_fn);
    }

    result.into()
}
