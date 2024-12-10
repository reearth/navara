use navara_quadtree::{QuadLeafHandle, Quadtree};

use crate::{RasterTile, VectorTile};

pub type TileHandle = QuadLeafHandle;

pub type RasterTileQuadtree = Quadtree<usize, RasterTile>;
pub type VectorTileQuadtree = Quadtree<usize, VectorTile>;
