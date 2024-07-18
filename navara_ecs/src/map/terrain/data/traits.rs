use std::fmt::Debug;

use bevy_ecs::entity::Entity;
use navara_core::TileRegion;
use navara_geometry::UpsampledTerrainGeometry;

pub trait TerrainData: Debug + Sync + Send {
    fn upsample(
        &self,
        region: &TileRegion,
        uvs: &[f32],
        heights: &[f32],
        indices: &[u32],
    ) -> Option<UpsampledTerrainGeometry>;
    fn data_requester_entity_id(&self) -> Option<Entity>;
    fn set_data_requester_entity_id(&mut self, e: Option<Entity>);
    // Indicates the max height of the terrain from the globe surface.
    fn current_max_height(&self) -> Option<f32>;
    fn set_current_max_height(&mut self, h: f32);
}
