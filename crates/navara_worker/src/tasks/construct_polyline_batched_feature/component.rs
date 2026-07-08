use bevy_ecs::{
    component::Component, entity::Entity, lifecycle::HookContext, world::DeferredWorld,
};
use navara_buffer_store::BufferStore;
use navara_core::{Extent, Radians};
use navara_feature_component::{batch::BatchTable, render::TransferablePolylineGeometry};
use navara_math::FloatType;

use crate::component::{WorkerTaskBundle, WorkerTaskResultConsumed};

#[derive(Component)]
pub struct ConstructPolylineBatchedFeatureMarker;

#[derive(Component, Clone, Debug)]
pub struct ConstructPolylineBatchedFeatureParameters {
    pub batched_feature: Entity,
    /// If it's true, the polyline will be constructed in flat.
    /// This is used to render the polyline as a texture.
    pub flat: bool,
    pub tile_extent: Option<Extent<FloatType, Radians>>,
}

/// The tessellated polyline returned by the worker, awaiting transfer to a
/// `RenderableFeature`. Holds non-reference-counted `BufferStore` handles: the
/// consumer (`transfer_batched_mesh`) shares them with the spawned feature and
/// must mark the task [`WorkerTaskResultConsumed`]; a result dropped without
/// that marker (e.g. its `BatchedFeature` died before transfer) frees its
/// buffers via the `on_remove` hook.
#[derive(Component, Clone, Debug)]
#[component(on_remove = free_unconsumed_buffers)]
pub struct ConstructPolylineBatchedFeatureResult {
    pub extent: Extent<FloatType, Radians>,
    pub geometry: TransferablePolylineGeometry,
}

/// `on_remove` hook: free the result's buffers unless a consumer took over
/// handle ownership (`WorkerTaskResultConsumed`). Consumption shares the live
/// handles with the spawned `RenderableFeature` instead of removing the
/// entries, so freeing unconditionally would destroy in-use geometry.
fn free_unconsumed_buffers(mut world: DeferredWorld, ctx: HookContext) {
    if world.get::<WorkerTaskResultConsumed>(ctx.entity).is_some() {
        return;
    }
    let Some(result) = world.get::<ConstructPolylineBatchedFeatureResult>(ctx.entity) else {
        return;
    };
    let mut geometry = result.geometry.clone();
    let Some(mut buf) = world.get_resource_mut::<BufferStore>() else {
        return;
    };
    let batch_ids = geometry.remove_buffers(&mut buf);
    if batch_ids.is_empty() {
        return;
    }
    let Some(mut batch_table) = world.get_resource_mut::<BatchTable>() else {
        return;
    };
    for id in batch_ids {
        batch_table.remove(&id);
    }
}

pub type ConstructPolylineBatchedFeatureWorkerTaskBundle = WorkerTaskBundle<
    ConstructPolylineBatchedFeatureMarker,
    ConstructPolylineBatchedFeatureParameters,
>;

#[cfg(test)]
mod test {
    use bevy_ecs::world::World;
    use navara_buffer_store::BufferStore;
    use navara_core::{Angle, Extent};
    use navara_feature_component::render::TransferablePolylineGeometry;
    use navara_geometry::TransferableFloatAttribute;

    use super::ConstructPolylineBatchedFeatureResult;
    use crate::component::WorkerTaskResultConsumed;

    fn spawn_result(buf: &mut BufferStore) -> ConstructPolylineBatchedFeatureResult {
        ConstructPolylineBatchedFeatureResult {
            extent: Extent {
                west: Angle::new(0.),
                south: Angle::new(0.),
                east: Angle::new(0.),
                north: Angle::new(0.),
            },
            geometry: TransferablePolylineGeometry {
                position: TransferableFloatAttribute {
                    data: buf.new_f32(vec![0.]),
                    size: 3,
                },
                position_high: None,
                position_low: None,
                start: None,
                start_high: None,
                start_low: None,
                forward_offset: None,
                end_high: None,
                end_low: None,
                start_normals: None,
                end_normal_and_texture_coordinate_normalization_x: None,
                right_normal_and_texture_coordinate_normalization_y: TransferableFloatAttribute {
                    data: buf.new_f32(vec![0.]),
                    size: 4,
                },
                batch_ids: None,
                batch_index: None,
                indices: buf.new_u32(vec![0]),
            },
        }
    }

    /// A result whose feature died before `transfer_batched_mesh` consumed it
    /// must free its geometry buffers on despawn.
    #[test]
    fn it_should_free_unconsumed_result_buffers_on_despawn() {
        let mut world = World::new();
        let mut buf = BufferStore::new();
        let result = spawn_result(&mut buf);
        assert_eq!(buf.len(), 3);
        world.insert_resource(buf);
        let e = world.spawn(result).id();

        world.despawn(e);

        assert!(world.resource::<BufferStore>().is_empty());
    }

    /// A consumed result's handles are shared with the rendered feature;
    /// despawning the task entity must leave them untouched.
    #[test]
    fn it_should_keep_transferred_buffers_when_result_was_consumed() {
        let mut world = World::new();
        let mut buf = BufferStore::new();
        let result = spawn_result(&mut buf);
        world.insert_resource(buf);
        let e = world.spawn((result, WorkerTaskResultConsumed)).id();

        world.despawn(e);

        assert_eq!(world.resource::<BufferStore>().len(), 3);
    }
}
