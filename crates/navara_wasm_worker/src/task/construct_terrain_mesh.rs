use navara_core::WGS84_64;
use navara_geometry::calculate_skirt_height;
use navara_tile_component::{MartiniComponent, RasterDEMData, RasterTile};
use navara_wasm_transferable::{TransferableMartini, TransferableRasterDEMData, TransferableTile};
use navara_wasm_types::ReturnedConstructedTerrainMesh;
use wasm_bindgen::prelude::wasm_bindgen;

#[wasm_bindgen(js_name = constructTerrainMesh)]
pub fn construct_terrain_mesh(
    bytes: &[u8],
    tile: TransferableTile,
    raster_dem_data: TransferableRasterDEMData,
    martini: TransferableMartini,
    skirt: bool,
    skirt_exaggeration: f32,
) -> ReturnedConstructedTerrainMesh {
    let mut tile: RasterTile = tile.into();
    let raster_dem_data: RasterDEMData = raster_dem_data.into();
    tile.terrain_data = Some(Box::new(raster_dem_data));

    let mut martini: MartiniComponent = martini.into();

    let terrain_data = tile.terrain_data.as_ref().unwrap();
    let mut result =
        terrain_data.construct_terrain_mesh(WGS84_64, &tile, bytes, 0., martini.get_mut());

    if skirt {
        let skirt_height = calculate_skirt_height(&WGS84_64, tile.coords.z, skirt_exaggeration);
        let down_dir_fn = navara_geometry::make_wgs84_down_dir_fn(WGS84_64, result.rtc_translation);
        navara_geometry::add_skirt_separate(&mut result.geometry, skirt_height, &down_dir_fn);
    }

    result.into()
}
