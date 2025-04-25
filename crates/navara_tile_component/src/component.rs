use bevy_ecs::component::Component;
use navara_core::TileXYZ;

use crate::TileHandle;

#[derive(Debug, Default, Component)]
pub struct TileMeshMarker(pub TileHandle);

/// Handle the tile coordinates as a component.
/// You should use [`TileXYZ`] for general use case.
#[derive(Debug, Clone, Component)]
pub struct TileCoordinates {
    pub x: usize,
    pub y: usize,
    pub z: usize,
    /// How much it is overscaled
    pub overscaled: usize,
}

impl TileCoordinates {
    fn new(x: usize, y: usize, z: usize) -> Self {
        Self {
            x,
            y,
            z,
            overscaled: 0,
        }
    }
}

impl From<TileXYZ> for TileCoordinates {
    fn from(value: TileXYZ) -> Self {
        TileCoordinates::new(value.x, value.y, value.z)
    }
}
