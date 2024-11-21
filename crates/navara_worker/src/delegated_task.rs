use bevy_ecs::component::Component;

use crate::{
    construct_terrain_mesh::delegated_task::ConstructTerrainMeshDelegatedWorkerTask,
    upsample_terrain_mesh::delegated_task::UpsampleTerrainMeshDelegatedWorkerTask,
};

pub struct DelegatedWorkerTask<P, R> {
    pub parameters: P,
    pub result: Option<R>,
}

impl<P, R> DelegatedWorkerTask<P, R> {
    pub fn new(p: P) -> Self {
        Self {
            parameters: p,
            result: None,
        }
    }
}

/// This is used to delegate the task to platform specific worker.
/// Worker system spawns this component, then this component is passed
/// to the platform through navara_wasm.
#[derive(Component)]
pub enum DelegatedWorkerTasks {
    ConstructTerrainMesh(ConstructTerrainMeshDelegatedWorkerTask),
    UpsampleTerrainMesh(UpsampleTerrainMeshDelegatedWorkerTask),
    // Polyline(...),
    // Polygon(...),
}
