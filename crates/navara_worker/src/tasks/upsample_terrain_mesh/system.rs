use bevy_ecs::{
    entity::Entity,
    query::{Added, With},
    system::{Commands, Query, Res, ResMut},
};
use navara_buffer_store::BufferStore;
use navara_core::WGS84_32;
use navara_geometry::TransferableGeometry;
use navara_tile_component::TileQuadtree;

use super::{UpsampleTerrainMeshParameters, UpsampleTerrainMeshResult};
use crate::WorkerTaskMarker;

#[allow(clippy::type_complexity)]
#[cfg(not(feature = "delegated_worker"))]
pub(crate) fn upsample_terrain_mesh(
    mut commands: Commands,
    qt: Res<TileQuadtree>,
    mut buf: ResMut<BufferStore>,
    constructors: Query<
        (Entity, &UpsampleTerrainMeshParameters),
        (Added<WorkerTaskMarker>, With<WorkerTaskMarker>),
    >,
) {
    for (e, constructor) in &constructors {
        let tile = match qt.qt.get(constructor.tile_handle) {
            Some(t) => t,
            None => continue,
        };
        let (geometry, heights, max_height, min_height) =
            tile.upsample(WGS84_32, &qt, &buf).unwrap();

        commands.entity(e).insert(UpsampleTerrainMeshResult {
            geometry: TransferableGeometry::with_buf(&mut buf, geometry),
            heights: buf.new_f32(heights),
            max_height,
            min_height,
        });
    }
}

#[allow(clippy::type_complexity)]
#[cfg(feature = "delegated_worker")]
pub(crate) fn upsample_terrain_mesh(
    mut commands: Commands,
    qt: Res<TileQuadtree>,
    mut buf: ResMut<BufferStore>,
    constructors: Query<
        (Entity, &UpsampleTerrainMeshParameters),
        (Added<WorkerTaskMarker>, With<WorkerTaskMarker>),
    >,
) {
    // TODO: Fill it later
}
