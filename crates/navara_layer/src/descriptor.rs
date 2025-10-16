use crate::{
    b3dm::B3dmLayer, Cesium3dTilesLayer, GeoJsonLayer, MvtLayer, TerrainLayer, TilesLayer, pnts::PntsLayer
};

#[derive(Debug, Clone, PartialEq)]
pub enum LayerDescription {
    Tiles(TilesLayer),
    Terrain(TerrainLayer),
    GeoJson(GeoJsonLayer),
    B3dm(B3dmLayer),
    Pnts(PntsLayer),
    Mvt(MvtLayer),
    Cesium3dTiles(Cesium3dTilesLayer),
}
