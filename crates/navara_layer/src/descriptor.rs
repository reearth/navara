use crate::{
    b3dm::B3dmLayer, pnts::PntsLayer, Cesium3dTilesLayer, GeoJsonLayer, MvtLayer, TerrainLayer,
    TilesLayer,
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

impl LayerDescription {
    pub fn merge(&self, other: &LayerDescription) -> LayerDescription {
        match (self, other) {
            (LayerDescription::Tiles(a), LayerDescription::Tiles(b)) => {
                let merged = a.merge(b);
                LayerDescription::Tiles(merged)
            }
            (LayerDescription::Terrain(a), LayerDescription::Terrain(b)) => {
                let merged = a.merge(b);
                LayerDescription::Terrain(merged)
            }
            (LayerDescription::GeoJson(a), LayerDescription::GeoJson(b)) => {
                let merged = a.merge(b);
                LayerDescription::GeoJson(merged)
            }
            (LayerDescription::B3dm(a), LayerDescription::B3dm(b)) => {
                let merged = a.merge(b);
                LayerDescription::B3dm(merged)
            }
            (LayerDescription::Pnts(a), LayerDescription::Pnts(b)) => {
                let merged = a.merge(b);
                LayerDescription::Pnts(merged)
            }
            (LayerDescription::Mvt(a), LayerDescription::Mvt(b)) => {
                let merged = a.merge(b);
                LayerDescription::Mvt(merged)
            }
            (LayerDescription::Cesium3dTiles(a), LayerDescription::Cesium3dTiles(b)) => {
                let merged = a.merge(b);
                LayerDescription::Cesium3dTiles(merged)
            }
            _ => self.clone(),
        }
    }
}