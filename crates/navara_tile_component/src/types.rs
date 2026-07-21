use std::ops::{Deref, DerefMut};

use navara_quadtree::{QuadLeafHandle, Quadtree};

use crate::{RasterTile, TerrainInformation, TerrainTile, VectorTile};

pub type TileHandle = QuadLeafHandle;

pub type TerrainTileQuadtree = Quadtree<usize, TerrainTile>;
pub type RasterTileQuadtree = Quadtree<usize, RasterTile>;
// Manage common terrain information.
pub type TerrainInformationQuadtree = Quadtree<usize, TerrainInformation>;

/// Since Bevy 0.19, `derive(Resource)` implies singleton resource-entity
/// semantics for the generated `Component` impl, so `Quadtree` (a resource for
/// terrain/raster tiles) can no longer also live on multiple entities. The
/// vector-tile quadtree is per-layer entity state, so it wraps the shared
/// `Quadtree` in a dedicated `Component` newtype.
#[derive(bevy_ecs::prelude::Component)]
pub struct VectorTileQuadtree(pub Quadtree<usize, VectorTile>);

impl VectorTileQuadtree {
    pub fn new_with_linear_qt() -> Self {
        Self(Quadtree::new_with_linear_qt())
    }
}

impl Deref for VectorTileQuadtree {
    type Target = Quadtree<usize, VectorTile>;

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

impl DerefMut for VectorTileQuadtree {
    fn deref_mut(&mut self) -> &mut Self::Target {
        &mut self.0
    }
}
