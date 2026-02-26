use crate::{
    Cesium3dTilesLayer, GeoJsonLayer, MvtLayer, TerrainLayer, TilesLayer, b3dm::B3dmLayer,
    pnts::PntsLayer,
};

#[derive(Debug, Clone, PartialEq)]
pub enum LayerDescription {
    Tiles(Box<TilesLayer>),
    Terrain(Box<TerrainLayer>),
    GeoJson(Box<GeoJsonLayer>),
    B3dm(Box<B3dmLayer>),
    Pnts(PntsLayer),
    Mvt(MvtLayer),
    Cesium3dTiles(Cesium3dTilesLayer),
}
