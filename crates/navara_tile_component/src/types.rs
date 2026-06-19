use navara_quadtree::{QuadLeafHandle, Quadtree};

use crate::{TerrainInformation, TerrainTile, VectorTile};

pub type TileHandle = QuadLeafHandle;

pub type TerrainTileQuadtree = Quadtree<usize, TerrainTile>;
pub type VectorTileQuadtree = Quadtree<usize, VectorTile>;
// Manage common terrain information.
pub type TerrainInformationQuadtree = Quadtree<usize, TerrainInformation>;
