use navara_material::Appearance;

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

    /// The render appearances currently stored for this layer.
    ///
    /// Used to merge partial appearance updates onto the previous state so
    /// fields left unset keep their current value instead of resetting to
    /// material defaults. `Terrain` carries its material outside the
    /// [`Appearance`] enum, so it reports no appearances here.
    pub fn appearances(&self) -> &[Appearance] {
        match self {
            LayerDescription::Tiles(l) => l.appearance.as_slice(),
            LayerDescription::Terrain(_) => &[],
            LayerDescription::GeoJson(l) => &l.appearances,
            LayerDescription::B3dm(l) => &l.appearances,
            LayerDescription::Pnts(l) => &l.appearances,
            LayerDescription::Mvt(l) => &l.appearances,
            LayerDescription::Cesium3dTiles(l) => &l.appearances,
        }
    }
}
