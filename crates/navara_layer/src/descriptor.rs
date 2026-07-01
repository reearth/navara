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

impl LayerDescription {
    /// The id of the source this layer references, if any.
    pub fn source_id(&self) -> Option<&str> {
        match self {
            LayerDescription::Tiles(l) => l.source_id.as_deref(),
            LayerDescription::Terrain(l) => l.source_id.as_deref(),
            LayerDescription::GeoJson(l) => l.source_id.as_deref(),
            LayerDescription::B3dm(l) => l.source_id.as_deref(),
            LayerDescription::Pnts(l) => l.source_id.as_deref(),
            LayerDescription::Mvt(l) => l.source_id.as_deref(),
            LayerDescription::Cesium3dTiles(l) => l.source_id.as_deref(),
        }
    }
}
