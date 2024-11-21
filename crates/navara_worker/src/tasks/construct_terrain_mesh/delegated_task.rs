use crate::DelegatedWorkerTask;

use super::ConstructTerrainMeshResult;

// TODO: Fill it later
pub struct DelegatableConstructTerrainMeshParameters {}

pub type DelegatableConstructTerrainMeshResult = ConstructTerrainMeshResult;

pub type ConstructTerrainMeshDelegatedWorkerTask = DelegatedWorkerTask<
    DelegatableConstructTerrainMeshParameters,
    DelegatableConstructTerrainMeshResult,
>;
