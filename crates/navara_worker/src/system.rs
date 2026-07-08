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
            DelegatedWorkerTasksResult::ParseMvtTile(DelegatedWorkerTask {
                delegator_id,
                value,
            }) => {
                if !constructors.contains(*delegator_id) {
                    // Task was deleted before completion - free the packed stream
                    // handles to prevent a BufferStore leak
                    value.remove_from_buf(&mut buf);
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
    mut buf: ResMut<BufferStore>,
    constructors: Query<
        (Entity, Option<&crate::parse_mvt_tile::ParseMvtTileResult>),
        (
            With<Deleted>,
            Or<(With<WorkerTaskMarker>, With<DelegatedWorkerTaskMarker>)>,
        ),
    >,
) {
    for (e, parse_mvt_result) in &constructors {
        // A parse result deleted before finalization (e.g. its tile was evicted
        // in the same frame the result arrived, so the finalize system's
        // `Without<Deleted>` filter never matched) still owns its packed
        // streams; free them before the component is dropped with the entity.
        // After a normal finalize the entries are already gone and handles are
        // never reused, so this is a no-op.
        if let Some(result) = parse_mvt_result {
            result.remove_from_buf(&mut buf);
        }
        commands.entity(e).despawn();
    }
}

#[cfg(test)]
mod test {
    use bevy_ecs::system::RunSystemOnce;
    use bevy_ecs::world::World;
    use navara_buffer_store::BufferStore;
    use navara_component::Deleted;

    use crate::component::WorkerTaskMarker;
    use crate::parse_mvt_tile::ParseMvtTileResult;

    /// A parse result whose delegator is deleted before finalization (tile
    /// evicted in the same frame the result arrived) must not leak its packed
    /// streams when `remove` despawns the entity.
    #[test]
    fn it_should_free_unconsumed_parse_streams_on_remove() {
        let mut world = World::new();
        let mut buf = BufferStore::new();
        let result = ParseMvtTileResult {
            f64_handle: buf.new_f64(vec![1.0, 2.0]),
            f32_handle: buf.new_f32(vec![1.0]),
            u32_handle: buf.new_u32(vec![1]),
            u8_handle: buf.new_u8(vec![1]),
            meta: Default::default(),
        };
        assert_eq!(buf.len(), 4);
        world.insert_resource(buf);
        let e = world.spawn((WorkerTaskMarker, Deleted, result)).id();

        world.run_system_once(super::remove).unwrap();

        assert!(world.get_entity(e).is_err());
        assert!(world.resource::<BufferStore>().is_empty());
    }

    /// Streams already taken by a normal finalize leave stale handles behind;
    /// despawning afterwards must stay a no-op (handles are never reused).
    #[test]
    fn it_should_not_touch_other_buffers_after_a_consumed_result() {
        let mut world = World::new();
        let mut buf = BufferStore::new();
        let result = ParseMvtTileResult {
            f64_handle: buf.new_f64(vec![1.0]),
            f32_handle: buf.new_f32(vec![1.0]),
            u32_handle: buf.new_u32(vec![1]),
            u8_handle: buf.new_u8(vec![1]),
            meta: Default::default(),
        };
        // Simulate finalization plus an unrelated buffer that must survive.
        result.take_streams(&mut buf);
        let live = buf.new_f32(vec![9.0]);
        world.insert_resource(buf);
        world.spawn((WorkerTaskMarker, Deleted, result));

        world.run_system_once(super::remove).unwrap();

        let buf = world.resource::<BufferStore>();
        assert_eq!(buf.len(), 1);
        assert!(buf.get_f32(&live).is_some());
    }
}
