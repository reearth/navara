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
    component::WorkerTaskMarker, DelegatedWorkerTask, DelegatedWorkerTaskMarker,
    DelegatedWorkerTasksResult, WorkerTaskCompleted, WorkerTaskCompletedEvent,
    WorkerTaskDelegateeMarker,
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

#[allow(clippy::type_complexity)]
pub fn remove(
    mut commands: Commands,
    constructors: Query<
        Entity,
        (
            With<Deleted>,
            Or<(With<WorkerTaskMarker>, With<DelegatedWorkerTaskMarker>)>,
        ),
    >,
) {
    for e in &constructors {
        commands.entity(e).despawn();
    }
}
