use bevy_ecs::component::Component;
use navara_buffer_store::Handle;
use navara_geometry::TransferableGeometry;
use navara_math::{FloatType, Vec3};
use navara_tile_component::TileHandle;
use serde::Serialize;

use crate::component::WorkerTaskBundle;

#[derive(Component)]
pub struct UpsampleTerrainMeshMarker;

#[derive(Component, Clone, Debug, Serialize)]
pub struct UpsampleTerrainMeshParameters {
    pub tile_handle: TileHandle,
}
#[derive(Component, Clone, Debug, Serialize)]
pub struct UpsampleTerrainMeshResult {
    pub geometry: TransferableGeometry,
    pub heights: Handle,
    pub min_height: FloatType,
    pub max_height: FloatType,
    pub rtc_translation: Option<Vec3>,
}

pub type UpsampleTerrainMeshWorkerTaskBundle =
    WorkerTaskBundle<UpsampleTerrainMeshMarker, UpsampleTerrainMeshParameters>;
