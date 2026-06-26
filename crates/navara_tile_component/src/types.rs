use navara_quadtree::{QuadLeafHandle, Quadtree};

use crate::{RasterTile, TerrainInformation, TerrainTile, VectorTile};

pub type TileHandle = QuadLeafHandle;

pub type TerrainTileQuadtree = Quadtree<usize, TerrainTile>;
pub type VectorTileQuadtree = Quadtree<usize, VectorTile>;
pub type RasterTileQuadtree = Quadtree<usize, RasterTile>;
// Manage common terrain information.
pub type TerrainInformationQuadtree = Quadtree<usize, TerrainInformation>;
