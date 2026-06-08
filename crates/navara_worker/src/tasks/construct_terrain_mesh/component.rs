use bevy_ecs::component::Component;
use navara_buffer_store::Handle;
use navara_geometry::TransferableGeometry;
use navara_math::{FloatType, Vec3};
use navara_tile_component::TileHandle;
use serde::Serialize;

use crate::component::WorkerTaskBundle;

#[derive(Component)]
pub struct ConstructTerrainMeshMarker;

#[derive(Component, Clone, Debug, Serialize)]
pub struct ConstructTerrainMeshParameters {
    pub tile_size: u32,
    pub bytes_handle: Handle,
    pub tile_handle: TileHandle,
    /// Whether to render skirts along tile boundaries.
    pub skirt: bool,
    /// Multiplier for the automatically calculated skirt height.
    pub skirt_exaggeration: f32,
    pub is_quantized_mesh: bool,
    /// EPSG:4326 geographic tiling (quantized mesh only)
    pub geographic: bool,
    /// TMS scheme (y=0 at south) (quantized mesh only)
    pub tms: bool,
}

#[derive(Component, Clone, Debug, Serialize)]
pub struct ConstructTerrainMeshResult {
    pub geometry: TransferableGeometry,
    pub heights: Handle,
    pub min_height: FloatType,
    pub max_height: FloatType,
    pub rtc_translation: Option<Vec3>,
}

pub type ConstructTerrainMeshWorkerTaskBundle =
    WorkerTaskBundle<ConstructTerrainMeshMarker, ConstructTerrainMeshParameters>;
