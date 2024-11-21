use crate::DelegatedWorkerTask;

use super::UpsampleTerrainMeshResult;

// TODO: Fill it later
pub struct DelegatableUpsampleTerrainMeshParameters {}

pub type DelegatableUpsampleTerrainMeshResult = UpsampleTerrainMeshResult;

pub type UpsampleTerrainMeshDelegatedWorkerTask = DelegatedWorkerTask<
    DelegatableUpsampleTerrainMeshParameters,
    DelegatableUpsampleTerrainMeshResult,
>;
