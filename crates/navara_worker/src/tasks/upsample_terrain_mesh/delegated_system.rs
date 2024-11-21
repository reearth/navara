use bevy_ecs::{
    entity::Entity,
    query::{Added, With},
    system::{Commands, Query, Res, ResMut},
};
use navara_buffer_store::BufferStore;
use navara_tile_component::TileQuadtree;

use super::UpsampleTerrainMeshParameters;
use crate::WorkerTaskMarker;

#[allow(clippy::type_complexity)]
pub(crate) fn upsample_terrain_mesh(
    mut _commands: Commands,
    _qt: Res<TileQuadtree>,
    mut _buf: ResMut<BufferStore>,
    _constructors: Query<
        (Entity, &UpsampleTerrainMeshParameters),
        (Added<WorkerTaskMarker>, With<WorkerTaskMarker>),
    >,
) {
    // TODO: Fill it later
}
