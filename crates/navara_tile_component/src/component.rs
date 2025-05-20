use bevy_ecs::component::Component;

use crate::TileHandle;

#[derive(Debug, Default, Component)]
pub struct TileMeshMarker {
    pub handle: TileHandle,
    pub ready_parent_tile_handle: Option<TileHandle>,
}

#[derive(Debug, Clone, Component)]
pub struct OverscaledTileHandle {
    pub handle: TileHandle,
    /// TODO: Support overscaled zoom in vector tile format like MVT.
    /// How much it is overscaled
    pub overscaled: usize,
}

impl OverscaledTileHandle {
    pub fn new(handle: TileHandle) -> Self {
        Self {
            handle,
            overscaled: 0,
        }
    }
}
