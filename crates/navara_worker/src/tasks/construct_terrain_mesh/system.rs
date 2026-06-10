use bevy_ecs::{
    entity::Entity,
    query::{Added, With, Without},
    system::{Commands, Query, Res, ResMut},
};
use bevy_log::error;
use navara_buffer_store::BufferStore;
use navara_component::Deleted;
use navara_core::WGS84_32;
use navara_geometry::TransferableGeometry;
use navara_tile_component::{MartiniComponent, TerrainConstructContext, TileQuadtree};

use super::{ConstructTerrainMeshParameters, ConstructTerrainMeshResult};
use crate::WorkerTaskMarker;

// #[cfg(not(feature = "delegated_worker"))]
pub fn setup_martini(
    mut commands: Commands,
    mut cached_martini: ResMut<CachedMartini>,
    layers: Query<&TerrainLayer, Added<TerrainLayer>>,
) {
    for layer in layers.iter() {
        let size = layer.appearance.as_ref().unwrap().tile_size();
        if cached_martini.get(&size).is_some() {
            continue;
        }

        cached_martini.insert(size, commands.spawn(MartiniComponent::new(size + 1)).id());
    }
}

#[allow(clippy::type_complexity)]
#[cfg(not(feature = "delegated_worker"))]
pub(crate) fn construct_terrain_mesh(
    mut commands: Commands,
    qt: Res<TileQuadtree>,
    mut buf: ResMut<BufferStore>,
    cached_martini: Res<CachedMartini>,
    constructors: Query<
        (Entity, &ConstructTerrainMeshParameters),
        (
            Added<WorkerTaskMarker>,
            With<WorkerTaskMarker>,
            Without<Deleted>,
        ),
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

        let ctx = TerrainConstructContext {
            coords: tile.coords,
            extent: tile.extent,
            max_height: tile.max_height,
        };

        let martini_opt = cached_martini
            .get(constructor.tile_size)
            .and_then(|id| martini_components.get_mut(*id).ok());

        let returned = if let Some(mut martini) = martini_opt {
            tile.terrain_data.as_ref().unwrap().construct_terrain_mesh(
                WGS84_32,
                &ctx,
                bytes,
                0.,
                Some(martini.get_mut()),
            )
        } else {
            tile.terrain_data
                .as_ref()
                .unwrap()
                .construct_terrain_mesh(WGS84_32, &ctx, bytes, 0., None)
        };

        let watermask_handle = returned.watermask.map(|w| buf.new_u8(w));
        commands.entity(e).insert(ConstructTerrainMeshResult {
            geometry: TransferableGeometry::with_buf(&mut buf, returned.geometry),
            heights: buf.new_f32(returned.heights),
            max_height: returned.max_height,
            min_height: returned.min_height,
            rtc_translation: returned.rtc_translation,
            watermask: watermask_handle,
        });
    }
}
