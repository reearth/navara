use bevy_ecs::{
    entity::Entity,
    query::{With, Without},
    system::{Commands, Query},
};
use navara_component::{Deleted, OrderByDistance, Priority, Requested};

use super::{ConstructTerrainMeshMarker, ConstructTerrainMeshParameters};
use crate::{
    DelegatedWorkerTask, DelegatedWorkerTasksParameters, DelegatedWorkerTasksParametersBundle,
    WorkerTaskCompleted, WorkerTaskDelegateeMarker, WorkerTaskMarker,
};

const MAX_PENDINGS: usize = 20;

#[allow(clippy::type_complexity)]
pub(crate) fn construct_terrain_mesh(
    mut commands: Commands,
    constructors: Query<
        (Entity, &ConstructTerrainMeshParameters, &OrderByDistance),
        (With<WorkerTaskMarker>, Without<Requested>, Without<Deleted>),
    >,
    requested_constructors: Query<
        (Entity, &ConstructTerrainMeshParameters, &OrderByDistance),
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
                ConstructTerrainMeshMarker,
                DelegatedWorkerTasksParameters::ConstructTerrainMesh(DelegatedWorkerTask::new(
                    e,
                    constructor.clone(),
                )),
                Priority::High,
            ))
            .id();
        commands
            .entity(e)
            .insert((WorkerTaskDelegateeMarker(delegatee_id), Requested));
    }
}
