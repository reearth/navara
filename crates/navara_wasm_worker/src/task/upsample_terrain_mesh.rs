use navara_core::WGS84_32;
use navara_tile_component::{RasterDEMData, RasterTile};
use navara_wasm_transferable::{TransferableRasterDEMData, TransferableTile};
use navara_wasm_types::{ReturnedConstructedTerrainMesh, UpsamplableTerrainGeometry};
use wasm_bindgen::prelude::wasm_bindgen;

#[wasm_bindgen(js_name = upsampleTerrainMesh)]
pub fn upsample_terrain_mesh(
    tile: TransferableTile,
    parent_tile: TransferableTile,
    raster_dem_data: TransferableRasterDEMData,
    upsamplable_geometry: UpsamplableTerrainGeometry,
) -> ReturnedConstructedTerrainMesh {
    let raster_dem_data: RasterDEMData = raster_dem_data.into();

    let mut tile: RasterTile = tile.into();
    tile.terrain_data = Some(Box::new(raster_dem_data.clone()));
    let mut parent_tile: RasterTile = parent_tile.into();
    parent_tile.terrain_data = Some(Box::new(raster_dem_data));

    let upsamplable_geometry: navara_geometry::UpsamplableTerrainGeometry =
        (&upsamplable_geometry).into();

    tile.upsample(WGS84_32, &parent_tile, upsamplable_geometry)
        .unwrap()
        .into()
}
