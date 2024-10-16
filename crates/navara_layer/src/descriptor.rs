use crate::{b3dm::B3dmLayer, GeoJsonLayer, TerrainLayer, TilesLayer};

#[derive(Debug, Clone, PartialEq)]
pub enum LayerDescription {
    Tiles(TilesLayer),
    Terrain(TerrainLayer),
    GeoJson(GeoJsonLayer),
    B3dm(B3dmLayer),
}
