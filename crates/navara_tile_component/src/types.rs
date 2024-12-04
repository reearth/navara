use navara_quadtree::{QuadLeafHandle, Quadtree};

use crate::Tile;

pub type TileHandle = QuadLeafHandle;

pub type TileQuadtree = Quadtree<usize, Tile>;
