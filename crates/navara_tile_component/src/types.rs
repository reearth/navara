use navara_quadtree::{QuadLeafHandle, Quadtree};

use crate::{RasterTile, TerrainInformation, VectorTile};

pub type TileHandle = QuadLeafHandle;

pub type RasterTileQuadtree = Quadtree<usize, RasterTile>;
pub type VectorTileQuadtree = Quadtree<usize, VectorTile>;
// Manage common terrain information.
pub type TerrainInformationQuadtree = Quadtree<usize, TerrainInformation>;
