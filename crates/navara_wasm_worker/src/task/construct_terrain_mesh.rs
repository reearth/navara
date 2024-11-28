use navara_core::WGS84_32;
use navara_tile_component::{MartiniComponent, RasterDEMData, Tile};
use navara_wasm_transferable::{TransferableMartini, TransferableRasterDEMData, TransferableTile};
use navara_wasm_types::ReturnedConstructedTerrainMesh;
use wasm_bindgen::prelude::wasm_bindgen;

#[wasm_bindgen(js_name = constructTerrainMesh)]
pub fn construct_terrain_mesh(
    bytes: &[u8],
    tile: TransferableTile,
    raster_dem_data: TransferableRasterDEMData,
    martini: TransferableMartini,
) -> ReturnedConstructedTerrainMesh {
    let mut tile: Tile = tile.into();
    let raster_dem_data: RasterDEMData = raster_dem_data.into();
    tile.terrain_data = Some(Box::new(raster_dem_data));

    let mut martini: MartiniComponent = martini.into();

    tile.terrain_data
        .as_ref()
        .unwrap()
        .construct_terrain_mesh(WGS84_32, &tile, bytes, 0., martini.get_mut())
        .into()
}
