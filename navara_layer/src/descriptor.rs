use crate::{TerrainLayer, TilesLayer};

#[derive(Debug, Clone, PartialEq)]
pub enum LayerDescription {
    Tiles(TilesLayer),
    Terrain(TerrainLayer),
}
