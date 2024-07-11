use bevy_ecs::entity::Entity;
use navara_core::{terrain::UpsampledTerrainMesh, TileRegion};

use super::TerrainData;

#[derive(Debug, Default)]
pub struct RasterDEMData {
    pub(crate) data_requester_entity_id: Option<Entity>,
    // Indicates the max height of the terrain from the globe surface.
    pub(crate) current_max_height: Option<f32>,
}

impl TerrainData for RasterDEMData {
    fn data_requester_entity_id(&self) -> Option<Entity> {
        self.data_requester_entity_id
    }
    fn set_data_requester_entity_id(&mut self, e: Option<Entity>) {
        self.data_requester_entity_id = e;
    }
    fn current_max_height(&self) -> Option<f32> {
        self.current_max_height
    }
    fn set_current_max_height(&mut self, h: f32) {
        self.current_max_height = Some(h);
    }
    fn upsample(
        &self,
        region: &TileRegion,
        uvs: &[f32],
        heights: &[f32],
        indices: &[u32],
    ) -> Option<UpsampledTerrainMesh> {
        Some(UpsampledTerrainMesh::new(uvs, heights, indices, region))
    }
}
