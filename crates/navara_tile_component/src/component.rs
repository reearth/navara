use bevy_ecs::component::Component;
use navara_core::{Radians, LLE};
use navara_math::FloatType;

use crate::TileHandle;

#[derive(Debug, Default, Component)]
pub struct TileMeshMarker {
    pub handle: TileHandle,
    pub ready_parent_tile_handle: Option<TileHandle>,
}

#[derive(Debug, Clone, Component)]
pub struct OverscaledTileHandle {
    pub handle: TileHandle,
}

impl OverscaledTileHandle {
    pub fn new(handle: TileHandle) -> Self {
        Self { handle }
    }
}

#[derive(Component, Debug, Clone)]
pub struct TerrainHeightObserver {
    pub lle: LLE<FloatType, Radians>,
    pub height: Option<FloatType>,
}
