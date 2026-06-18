use bevy_ecs::{
    entity::Entity,
    message::MessageReader,
    query::{Added, Or, With, Without},
    system::{Commands, Query, ResMut},
};
use navara_buffer_store::BufferStore;
use navara_component::Deleted;
use navara_event_store::EventStore;
use navara_feature_component::batch::BatchTable;

use crate::{
    DelegatedWorkerTask, DelegatedWorkerTaskMarker, DelegatedWorkerTasksResult,
    WorkerTaskCompleted, WorkerTaskCompletedEvent, WorkerTaskDelegateeMarker,
    component::WorkerTaskMarker,
    tasks::{
        construct_polygon_batched_feature::ConstructPolygonBatchedFeatureResult,
        construct_polyline_batched_feature::ConstructPolylineBatchedFeatureResult,
        construct_terrain_mesh::ConstructTerrainMeshResult,
        upsample_terrain_mesh::UpsampleTerrainMeshResult,
    },
};

pub fn commit(
    mut events: ResMut<EventStore>,
    added: Query<Entity, (Added<DelegatedWorkerTaskMarker>, Without<Deleted>)>,
    removed: Query<Entity, (With<DelegatedWorkerTaskMarker>, With<Deleted>)>,
) {
    for e in &added {
        events.worker_task_delegated.push(e);
    }
    for e in &removed {
        events.worker_task_removed.push(e);
    }
}

#[allow(clippy::type_complexity)]
pub fn handle_completed_event(
    mut commands: Commands,
    mut loaded_ev: MessageReader<WorkerTaskCompletedEvent>,
    mut buf: ResMut<BufferStore>,
    mut batch_table: ResMut<BatchTable>,
    constructors: Query<
        Entity,
        (
            With<WorkerTaskMarker>,
            Without<WorkerTaskCompleted>,
            Without<Deleted>,
        ),
    >,
) {
    for e in loaded_ev.read() {
        match &e.result {
            DelegatedWorkerTasksResult::ConstructTerrainMesh(DelegatedWorkerTask {
                delegator_id,
                value,
            }) => {
                if !constructors.contains(*delegator_id) {
                    // Task was deleted before completion - clean up geometry handles to prevent memory leak
                    let geometry = value.geometry.clone();
                    geometry.remove_from_buf(&mut buf);
                    continue;
                }
                commands
                    .entity(*delegator_id)
                    .insert((value.clone(), WorkerTaskCompleted));
            }
            DelegatedWorkerTasksResult::UpsampleTerrainMesh(DelegatedWorkerTask {
                delegator_id,
                value,
            }) => {
                if !constructors.contains(*delegator_id) {
                    // Task was deleted before completion - clean up geometry handles to prevent memory leak
                    let geometry = value.geometry.clone();
                    geometry.remove_from_buf(&mut buf);
                    continue;
                }
                commands
                    .entity(*delegator_id)
                    .insert((value.clone(), WorkerTaskCompleted));
            }
            DelegatedWorkerTasksResult::ConstructPolygonBatchedFeature(DelegatedWorkerTask {
                delegator_id,
                value,
            }) => {
                if !constructors.contains(*delegator_id) {
                    // Task was deleted before completion - clean up geometry handles to prevent memory leak
                    let mut geometry = value.geometry.clone();
                    geometry.remove_from_buf(&mut buf, &mut batch_table);
                    continue;
                }
                commands
                    .entity(*delegator_id)
                    .insert((value.clone(), WorkerTaskCompleted));
            }
            DelegatedWorkerTasksResult::ConstructPolylineBatchedFeature(DelegatedWorkerTask {
                delegator_id,
                value,
            }) => {
                if !constructors.contains(*delegator_id) {
                    // Task was deleted before completion - clean up geometry handles to prevent memory leak
                    let mut geometry = value.geometry.clone();
                    geometry.remove_from_buf(&mut buf, &mut batch_table);
                    continue;
                }
                commands
                    .entity(*delegator_id)
                    .insert((value.clone(), WorkerTaskCompleted));
            }
        }
        commands.entity(e.parameters_id).insert(Deleted);
    }
}

pub fn remove_relation(
    mut commands: Commands,
    worker_tasks: Query<&WorkerTaskDelegateeMarker, With<Deleted>>,
) {
    for m in &worker_tasks {
        let Ok(mut e) = commands.get_entity(m.0) else {
            continue;
        };
        e.insert(Deleted);
    }
}

#[allow(clippy::type_complexity, clippy::too_many_arguments)]
pub fn remove(
    mut commands: Commands,
    mut buf: ResMut<BufferStore>,
    mut batch_table: ResMut<BatchTable>,
    constructors: Query<
        Entity,
        (
            With<Deleted>,
            Or<(With<WorkerTaskMarker>, With<DelegatedWorkerTaskMarker>)>,
        ),
    >,
    // Consumers (update_tiles / construct_*_batched_feature) remove the result
    // component when they take ownership of the handles. Anything still attached
    // at despawn time was never consumed → its handles would leak. Free them
    // here. `buf.remove` is idempotent.
    terrain_results: Query<&ConstructTerrainMeshResult, With<Deleted>>,
    upsample_results: Query<&UpsampleTerrainMeshResult, With<Deleted>>,
    polygon_results: Query<&ConstructPolygonBatchedFeatureResult, With<Deleted>>,
    polyline_results: Query<&ConstructPolylineBatchedFeatureResult, With<Deleted>>,
) {
    for e in &constructors {
        if let Ok(result) = terrain_results.get(e) {
            result.geometry.remove_from_buf(&mut buf);
            buf.remove(&result.heights);
            if let Some(h) = result.watermask {
                buf.remove(&h);
            }
        }
        if let Ok(result) = upsample_results.get(e) {
            result.geometry.remove_from_buf(&mut buf);
            buf.remove(&result.heights);
        }
        if let Ok(mut result) = polygon_results.get(e).cloned() {
            result.geometry.remove_from_buf(&mut buf, &mut batch_table);
            if let Some(mut outline) = result.outline_geometry.clone() {
                outline.remove_from_buf(&mut buf);
            }
        }
        if let Ok(mut result) = polyline_results.get(e).cloned() {
            result.geometry.remove_from_buf(&mut buf, &mut batch_table);
        }
        commands.entity(e).despawn();
    }
}
