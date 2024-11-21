use bevy_ecs::{
    entity::Entity,
    query::{Added, With},
    system::{Commands, Query, Res, ResMut},
};
use bevy_log::error;
use navara_buffer_store::BufferStore;
use navara_core::WGS84_32;
use navara_geometry::TransferableGeometry;
use navara_tile_component::{MartiniComponent, TileQuadtree};

use super::{ConstructTerrainMeshParameters, ConstructTerrainMeshResult};
use crate::WorkerTaskMarker;

#[allow(clippy::type_complexity)]
#[cfg(not(feature = "delegated_worker"))]
pub(crate) fn construct_terrain_mesh(
    mut commands: Commands,
    qt: Res<TileQuadtree>,
    mut buf: ResMut<BufferStore>,
    constructors: Query<
        (Entity, &ConstructTerrainMeshParameters),
        (Added<WorkerTaskMarker>, With<WorkerTaskMarker>),
    >,
    mut martini_components: Query<&mut MartiniComponent>,
) {
    for (e, constructor) in &constructors {
        // FIXME: This data will be removable after terrain mesh is constructed.
        let bytes = match buf.get_u8(&constructor.bytes_handle) {
            Some(data) => data,
            None => {
                error!("This line should be invoked only when the terrain data is ready");
                continue;
            }
        };

        let tile = match qt.qt.get(constructor.tile_handle) {
            Some(t) => t,
            None => continue,
        };
        let mut martini = martini_components.get_mut(constructor.martini_id).unwrap();

        let (triangles, max_height, min_height, heights) = tile
            .terrain_data
            .as_ref()
            .unwrap()
            .construct_terrain_mesh(WGS84_32, tile, bytes, 0., martini.get_mut());

        commands.entity(e).insert(ConstructTerrainMeshResult {
            geometry: TransferableGeometry::with_buf(&mut buf, triangles),
            heights: buf.new_f32(heights),
            max_height,
            min_height,
        });
    }
}

#[warn(clippy::type_complexity)]
#[cfg(feature = "delegated_worker")]
pub(crate) fn construct_terrain_mesh(
    mut commands: Commands,
    qt: Res<TileQuadtree>,
    mut buf: ResMut<BufferStore>,
    constructors: Query<
        (Entity, &ConstructTerrainMeshParameters),
        (
            Added<ConstructTerrainMeshMarker>,
            With<ConstructTerrainMeshMarker>,
        ),
    >,
    mut martini_components: Query<&mut MartiniComponent>,
) {
    // TODO: Fill it later
}
