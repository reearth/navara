use bevy_ecs::{bundle::Bundle, component::Component, entity::Entity};
use navara_component::Priority;

use crate::{
    construct_polygon_batched_feature::{
        DelegatableConstructPolygonBatchedFeatureParameters,
        DelegatableConstructPolygonBatchedFeatureResult,
    },
    construct_polyline_batched_feature::{
        DelegatableConstructPolylineBatchedFeatureParameters,
        DelegatableConstructPolylineBatchedFeatureResult,
    },
    construct_terrain_mesh::{
        DelegatableConstructTerrainMeshParameters, DelegatableConstructTerrainMeshResult,
    },
    upsample_terrain_mesh::{
        DelegatableUpsampleTerrainMeshParameters, DelegatableUpsampleTerrainMeshResult,
    },
};

#[derive(Component)]
pub struct DelegatedWorkerTaskMarker;

#[derive(Debug)]
pub struct DelegatedWorkerTask<V> {
    pub delegator_id: Entity,
    pub value: V,
}

impl<V> DelegatedWorkerTask<V> {
    pub fn new(delegator_id: Entity, value: V) -> Self {
        Self {
            delegator_id,
            value,
        }
    }

    pub fn with_bits(delegator_id: u64, value: V) -> Self {
        Self {
            delegator_id: Entity::from_bits(delegator_id),
            value,
        }
    }
}

/// This is used to delegate the task to platform specific worker.
/// Worker system spawns this component, then this component is passed
/// to the platform through navara_wasm.
/// The reason why we have bundled tasks as one enum is that
/// we need to manage the priority of each task for each platform.
#[derive(Component, Debug)]
pub enum DelegatedWorkerTasksParameters {
    ConstructTerrainMesh(DelegatedWorkerTask<DelegatableConstructTerrainMeshParameters>),
    UpsampleTerrainMesh(DelegatedWorkerTask<DelegatableUpsampleTerrainMeshParameters>),
    ConstructPolygonBatchedFeature(
        DelegatedWorkerTask<DelegatableConstructPolygonBatchedFeatureParameters>,
    ),
    ConstructPolylineBatchedFeature(
        DelegatedWorkerTask<DelegatableConstructPolylineBatchedFeatureParameters>,
    ),
    // Polyline(...),
}

#[derive(Bundle)]
pub struct DelegatedWorkerTasksParametersBundle<M: Component> {
    pub worker_task_marker: DelegatedWorkerTaskMarker,
    pub marker: M,
    pub task: DelegatedWorkerTasksParameters,
    pub priority: Priority,
}

impl<M: Component> DelegatedWorkerTasksParametersBundle<M> {
    pub fn new(marker: M, task: DelegatedWorkerTasksParameters, priority: Priority) -> Self {
        Self {
            worker_task_marker: DelegatedWorkerTaskMarker,
            marker,
            task,
            priority,
        }
    }
}

/// This is used to get the result of task from platform specific worker.
#[derive(Component, Debug)]
pub enum DelegatedWorkerTasksResult {
    ConstructTerrainMesh(DelegatedWorkerTask<DelegatableConstructTerrainMeshResult>),
    UpsampleTerrainMesh(DelegatedWorkerTask<DelegatableUpsampleTerrainMeshResult>),
    ConstructPolygonBatchedFeature(
        DelegatedWorkerTask<DelegatableConstructPolygonBatchedFeatureResult>,
    ),
    ConstructPolylineBatchedFeature(
        DelegatedWorkerTask<DelegatableConstructPolylineBatchedFeatureResult>,
    ),
    // Polyline(...),
    // Polygon(...),
}
