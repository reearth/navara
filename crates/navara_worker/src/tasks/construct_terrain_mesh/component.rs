use bevy_ecs::{component::Component, entity::Entity};
use navara_buffer_store::Handle;
use navara_geometry::TransferableGeometry;
use navara_math::FloatType;
use navara_tile_component::TileHandle;
use serde::Serialize;

use crate::component::WorkerTaskBundle;

#[derive(Component)]
pub struct ConstructTerrainMeshMarker;

#[derive(Component, Clone, Debug, Serialize)]
pub struct ConstructTerrainMeshParameters {
    pub martini_id: Entity,
    pub bytes_handle: Handle,
    pub tile_handle: TileHandle,
}

#[derive(Component, Clone, Debug, Serialize)]
pub struct ConstructTerrainMeshResult {
    pub geometry: TransferableGeometry,
    pub heights: Handle,
    pub min_height: FloatType,
    pub max_height: FloatType,
}

pub type ConstructTerrainMeshWorkerTaskBundle =
    WorkerTaskBundle<ConstructTerrainMeshMarker, ConstructTerrainMeshParameters>;
