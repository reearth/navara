mod task;
use serde::Serialize;
use wasm_bindgen::prelude::*;

use crate::entity::ReconstructableEntity;

#[wasm_bindgen]
#[derive(Debug, Clone, Serialize)]
pub struct WorkerTaskDelegatedEvent {
    pub ind: u32,
    pub gen: u32,
    pub bits: u64,

    #[wasm_bindgen(getter_with_clone)]
    pub task: DelegatedWorkerTasksParameters,
}

#[wasm_bindgen]
#[derive(Debug, Clone, Default, Serialize)]
pub struct DelegatedWorkerTasksParameters {
    #[wasm_bindgen(getter_with_clone)]
    pub delegator_id: ReconstructableEntity,
    #[wasm_bindgen(getter_with_clone)]
    pub construct_terrain_mesh:
        Option<task::construct_terrain_mesh::ConstructTerrainMeshParameters>,
    #[wasm_bindgen(getter_with_clone)]
    pub upsample_terrain_mesh: Option<task::upsample_terrain_mesh::UpsampleTerrainMeshParameters>,
    #[wasm_bindgen(getter_with_clone)]
    pub construct_polygon_batched_feature:
        Option<task::construct_polygon_batched_feature::ConstructPolygonBatchedFeatureParameters>,
}

impl<'a>
    From<
        navara_event_store::ReconstructableComponentEvent<
            &'a navara_worker::DelegatedWorkerTasksParameters,
        >,
    > for WorkerTaskDelegatedEvent
{
    fn from(
        ev: navara_event_store::ReconstructableComponentEvent<
            &'a navara_worker::DelegatedWorkerTasksParameters,
        >,
    ) -> Self {
        Self {
            ind: ev.ind,
            gen: ev.gen,
            bits: ev.bits,
            task: ev.comp.into(),
        }
    }
}

impl<'a> From<&'a navara_worker::DelegatedWorkerTasksParameters>
    for DelegatedWorkerTasksParameters
{
    fn from(v: &'a navara_worker::DelegatedWorkerTasksParameters) -> Self {
        match v {
            navara_worker::DelegatedWorkerTasksParameters::ConstructTerrainMesh(
                navara_worker::DelegatedWorkerTask {
                    delegator_id,
                    value,
                },
            ) => Self {
                delegator_id: ReconstructableEntity(delegator_id.to_bits()),
                construct_terrain_mesh: Some(value.into()),
                ..Default::default()
            },
            navara_worker::DelegatedWorkerTasksParameters::UpsampleTerrainMesh(
                navara_worker::DelegatedWorkerTask {
                    delegator_id,
                    value,
                },
            ) => Self {
                delegator_id: ReconstructableEntity(delegator_id.to_bits()),
                upsample_terrain_mesh: Some(value.into()),
                ..Default::default()
            },
            navara_worker::DelegatedWorkerTasksParameters::ConstructPolygonBatchedFeature(
                navara_worker::DelegatedWorkerTask {
                    delegator_id,
                    value,
                },
            ) => Self {
                delegator_id: ReconstructableEntity(delegator_id.to_bits()),
                construct_polygon_batched_feature: Some(value.into()),
                ..Default::default()
            },
        }
    }
}

#[wasm_bindgen]
#[derive(Debug, Clone, Default, Serialize)]
pub struct DelegatedWorkerTasksResult {
    #[wasm_bindgen(getter_with_clone)]
    pub delegator_id: ReconstructableEntity,
    #[wasm_bindgen(getter_with_clone)]
    pub construct_terrain_mesh: Option<task::construct_terrain_mesh::ConstructTerrainMeshResult>,
    #[wasm_bindgen(getter_with_clone)]
    pub upsample_terrain_mesh: Option<task::upsample_terrain_mesh::UpsampleTerrainMeshResult>,
    #[wasm_bindgen(getter_with_clone)]
    pub construct_polygon_batched_feature:
        Option<task::construct_polygon_batched_feature::ConstructPolygonBatchedFeatureResult>,
}

#[wasm_bindgen]
impl DelegatedWorkerTasksResult {
    #[wasm_bindgen(js_name = "withConstructTerrainMesh")]
    pub fn with_construct_terrain_mesh(
        delegator_id: ReconstructableEntity,
        construct_terrain_mesh: Option<task::construct_terrain_mesh::ConstructTerrainMeshResult>,
    ) -> Self {
        Self {
            delegator_id,
            construct_terrain_mesh,
            upsample_terrain_mesh: None,
            construct_polygon_batched_feature: None,
        }
    }

    #[wasm_bindgen(js_name = "withUpsampleTerrainMesh")]
    pub fn with_upsample_terrain_mesh(
        delegator_id: ReconstructableEntity,
        upsample_terrain_mesh: Option<task::upsample_terrain_mesh::UpsampleTerrainMeshResult>,
    ) -> Self {
        Self {
            delegator_id,
            construct_terrain_mesh: None,
            upsample_terrain_mesh,
            construct_polygon_batched_feature: None,
        }
    }

    #[wasm_bindgen(js_name = "withConstructPolygonBatchedFeature")]
    pub fn with_construct_polygon_batched_feature(
        delegator_id: ReconstructableEntity,
        construct_polygon_batched_feature: Option<
            task::construct_polygon_batched_feature::ConstructPolygonBatchedFeatureResult,
        >,
    ) -> Self {
        Self {
            delegator_id,
            construct_terrain_mesh: None,
            upsample_terrain_mesh: None,
            construct_polygon_batched_feature,
        }
    }
}

impl<'a> From<&'a navara_worker::DelegatedWorkerTasksResult> for DelegatedWorkerTasksResult {
    fn from(v: &'a navara_worker::DelegatedWorkerTasksResult) -> Self {
        match v {
            navara_worker::DelegatedWorkerTasksResult::ConstructTerrainMesh(
                navara_worker::DelegatedWorkerTask {
                    delegator_id,
                    value,
                },
            ) => Self {
                delegator_id: ReconstructableEntity(delegator_id.to_bits()),
                construct_terrain_mesh: Some(value.into()),
                ..Default::default()
            },
            navara_worker::DelegatedWorkerTasksResult::UpsampleTerrainMesh(
                navara_worker::DelegatedWorkerTask {
                    delegator_id,
                    value,
                },
            ) => Self {
                delegator_id: ReconstructableEntity(delegator_id.to_bits()),
                upsample_terrain_mesh: Some(value.into()),
                ..Default::default()
            },
            navara_worker::DelegatedWorkerTasksResult::ConstructPolygonBatchedFeature(
                navara_worker::DelegatedWorkerTask {
                    delegator_id,
                    value,
                },
            ) => Self {
                delegator_id: ReconstructableEntity(delegator_id.to_bits()),
                construct_polygon_batched_feature: Some(value.into()),
                ..Default::default()
            },
        }
    }
}
