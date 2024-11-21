use bevy_ecs::{
    entity::Entity,
    query::{Added, With},
    system::{Commands, Query, Res, ResMut},
};
use navara_buffer_store::BufferStore;
use navara_tile_component::{MartiniComponent, TileQuadtree};

use super::ConstructTerrainMeshParameters;
use crate::WorkerTaskMarker;

#[allow(clippy::type_complexity)]
pub(crate) fn construct_terrain_mesh(
    mut _commands: Commands,
    _qt: Res<TileQuadtree>,
    mut _buf: ResMut<BufferStore>,
    _constructors: Query<
        (Entity, &ConstructTerrainMeshParameters),
        (Added<WorkerTaskMarker>, With<WorkerTaskMarker>),
    >,
    mut _martini_components: Query<&mut MartiniComponent>,
) {
    // TODO: Fill it later
}
