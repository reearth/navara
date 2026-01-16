use bevy_ecs::{
    entity::Entity,
    query::{With, Without},
    system::{Commands, Query},
};
use navara_component::{Deleted, OrderByDistance, Priority, Requested};

use super::{ConstructPolylineBatchedFeatureMarker, ConstructPolylineBatchedFeatureParameters};
use crate::{
    DelegatedWorkerTask, DelegatedWorkerTasksParameters, DelegatedWorkerTasksParametersBundle,
    WorkerTaskCompleted, WorkerTaskDelegateeMarker, WorkerTaskMarker,
};

const MAX_PENDINGS: usize = 10;

#[allow(clippy::type_complexity)]
pub(crate) fn construct_polyline_batched_feature(
    mut commands: Commands,
    constructors: Query<
        (
            Entity,
            &ConstructPolylineBatchedFeatureParameters,
            &OrderByDistance,
        ),
        (With<WorkerTaskMarker>, Without<Requested>, Without<Deleted>),
    >,
    requested_constructors: Query<
        (
            Entity,
            &ConstructPolylineBatchedFeatureParameters,
            &OrderByDistance,
        ),
        (
            With<WorkerTaskMarker>,
            With<Requested>,
            Without<Deleted>,
            Without<WorkerTaskCompleted>,
        ),
    >,
) {
    let pendings = requested_constructors.iter().count();
    let num_take = (MAX_PENDINGS as i32 - pendings as i32).max(0) as usize;

    for (e, constructor, _) in constructors
        .iter()
        .sort::<&OrderByDistance>()
        .take(num_take)
    {
        let delegatee_id = commands
            .spawn(DelegatedWorkerTasksParametersBundle::new(
                ConstructPolylineBatchedFeatureMarker,
                DelegatedWorkerTasksParameters::ConstructPolylineBatchedFeature(
                    DelegatedWorkerTask::new(e, constructor.clone()),
                ),
                Priority::Medium,
            ))
            .id();
        commands
            .entity(e)
            .insert((WorkerTaskDelegateeMarker(delegatee_id), Requested));
    }
}
