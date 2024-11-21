use navara_quadtree::Quadtree;

use crate::Tile;

pub type TileHandle = u64;

pub type TileQuadtree = Quadtree<usize, Tile>;
