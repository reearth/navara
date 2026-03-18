use bevy_ecs::{component::Component, entity::Entity};
use navara_core::{Extent, LLE, Radians};
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

#[derive(Debug, Clone, Component)]
pub struct TileExtent {
    pub extent: Extent<FloatType, Radians>,
}

impl TileExtent {
    pub fn new(extent: Extent<FloatType, Radians>) -> Self {
        Self { extent }
    }
}

#[derive(Component, Debug, Clone)]
pub struct TerrainHeightObserver {
    pub lle: LLE<FloatType, Radians>,
    pub height: Option<FloatType>,
}

/// Data for a single hillshade backfill event
/// Contains all information needed to update hillshade textures in JS
#[derive(Debug, Clone, Copy)]
pub struct HillshadeBackfillEventData {
    pub tile_handle: u64,
    /// Edge data handle for updating edges
    /// -1 when only creating initial texture (no edge update)
    pub edge_data_handle: i32,
    /// Original DEM data handle (256×256 RGBA)
    /// Some() when texture needs to be created for the first time
    /// None when only updating edges
    pub original_handle: Option<i32>,
    /// Target entity (DataRequester entity) that owns the texture
    /// For edge updates, this points to the actual DataRequester
    pub target_entity: Option<Entity>,
    /// Edge direction: 0=Left, 1=Right, 2=Top, 3=Bottom
    /// 255 when not applicable (initialization)
    pub edge_direction: u8,
}

/// Component storing multiple hillshade backfill events for a single entity
/// Attached to the main DataRequester entity when backfill events are generated
#[derive(Component, Debug, Clone)]
pub struct HillshadeBackfillEvents {
    pub events: Vec<HillshadeBackfillEventData>,
}
