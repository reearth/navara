use bevy_ecs::{component::Component, lifecycle::HookContext, world::DeferredWorld};
use navara_buffer_store::{BufferStore, Handle};
use navara_geometry::TransferableGeometry;
use navara_math::{FloatType, Vec3};
use navara_tile_component::TileHandle;
use serde::Serialize;

use crate::component::{WorkerTaskBundle, WorkerTaskResultConsumed};

#[derive(Component)]
pub struct ConstructTerrainMeshMarker;

#[derive(Component, Clone, Debug, Serialize)]
pub struct ConstructTerrainMeshParameters {
    pub tile_size: u32,
    pub bytes_handle: Handle,
    pub tile_handle: TileHandle,
    /// Whether to render skirts along tile boundaries.
    pub skirt: bool,
    /// Multiplier for the automatically calculated skirt height.
    pub skirt_exaggeration: f32,
    pub is_quantized_mesh: bool,
    /// EPSG:4326 geographic tiling (quantized mesh only)
    pub geographic: bool,
    /// TMS scheme (y=0 at south) (quantized mesh only)
    pub tms: bool,
}

/// The constructed mesh returned by the worker, awaiting transfer to a tile
/// mesh. Holds non-reference-counted `BufferStore` handles: the consumer
/// (`transfer_mesh`) moves them into the spawned mesh and must mark the task
/// [`WorkerTaskResultConsumed`]; a result dropped without that marker (e.g.
/// its tile was torn down before transfer) frees its buffers via the
/// `on_remove` hook.
#[derive(Component, Clone, Debug, Serialize)]
#[component(on_remove = free_unconsumed_buffers)]
pub struct ConstructTerrainMeshResult {
    pub geometry: TransferableGeometry,
    pub heights: Handle,
    pub min_height: FloatType,
    pub max_height: FloatType,
    pub rtc_translation: Option<Vec3>,
    pub watermask: Option<Handle>,
}

/// `on_remove` hook: free the result's buffers unless a consumer took over
/// handle ownership (`WorkerTaskResultConsumed`). Unlike the MVT parse result,
/// consumption transfers the live handles to the tile mesh instead of removing
/// the entries, so freeing unconditionally would destroy in-use mesh data.
fn free_unconsumed_buffers(mut world: DeferredWorld, ctx: HookContext) {
    if world.get::<WorkerTaskResultConsumed>(ctx.entity).is_some() {
        return;
    }
    let Some(result) = world.get::<ConstructTerrainMeshResult>(ctx.entity) else {
        return;
    };
    let geometry = result.geometry.clone();
    let heights = result.heights;
    let watermask = result.watermask;
    let Some(mut buf) = world.get_resource_mut::<BufferStore>() else {
        return;
    };
    geometry.remove_from_buf(&mut buf);
    buf.remove(&heights);
    if let Some(watermask) = watermask {
        buf.remove(&watermask);
    }
}

pub type ConstructTerrainMeshWorkerTaskBundle =
    WorkerTaskBundle<ConstructTerrainMeshMarker, ConstructTerrainMeshParameters>;

#[cfg(test)]
mod test {
    use bevy_ecs::world::World;
    use navara_buffer_store::BufferStore;
    use navara_geometry::TransferableGeometry;

    use super::ConstructTerrainMeshResult;
    use crate::component::WorkerTaskResultConsumed;

    fn spawn_result(buf: &mut BufferStore) -> ConstructTerrainMeshResult {
        ConstructTerrainMeshResult {
            geometry: TransferableGeometry {
                vertices: buf.new_f32(vec![0.]),
                uvs: buf.new_f32(vec![0.]),
                indices: buf.new_u32(vec![0]),
                normals: None,
                skirt_vertices: None,
                skirt_uvs: None,
                skirt_indices: None,
                skirt_normals: None,
            },
            heights: buf.new_f32(vec![0.]),
            min_height: 0.,
            max_height: 0.,
            rtc_translation: None,
            watermask: Some(buf.new_u8(vec![1])),
        }
    }

    /// A result whose tile was torn down before `transfer_mesh` consumed it
    /// must free its geometry, heights, and watermask buffers on despawn.
    #[test]
    fn it_should_free_unconsumed_result_buffers_on_despawn() {
        let mut world = World::new();
        let mut buf = BufferStore::new();
        let result = spawn_result(&mut buf);
        assert_eq!(buf.len(), 5);
        world.insert_resource(buf);
        let e = world.spawn(result).id();

        world.despawn(e);

        assert!(world.resource::<BufferStore>().is_empty());
    }

    /// A consumed result's handles now belong to the tile mesh; despawning the
    /// task entity must leave them untouched.
    #[test]
    fn it_should_keep_transferred_buffers_when_result_was_consumed() {
        let mut world = World::new();
        let mut buf = BufferStore::new();
        let result = spawn_result(&mut buf);
        world.insert_resource(buf);
        let e = world.spawn((result, WorkerTaskResultConsumed)).id();

        world.despawn(e);

        assert_eq!(world.resource::<BufferStore>().len(), 5);
    }
}
