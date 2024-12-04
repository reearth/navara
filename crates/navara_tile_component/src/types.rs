use navara_quadtree::{QuadLeafHandle, Quadtree};

use crate::RasterTile;

pub type TileHandle = QuadLeafHandle;

pub type RasterTileQuadtree = Quadtree<usize, RasterTile>;
