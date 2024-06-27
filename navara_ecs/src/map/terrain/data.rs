use bevy_ecs::entity::Entity;

#[derive(Debug, Default)]
pub struct TerrainData {
    pub(crate) data_requester_entity_id: Option<Entity>,
    pub(crate) upsampled_mesh_entity_id: Option<Entity>,
    // Indicates the max height of the terrain from the globe surface.
    pub(crate) current_max_height: Option<f32>,
}

impl TerrainData {
    pub(crate) fn is_upsampled(&self) -> bool {
        self.upsampled_mesh_entity_id.is_some()
    }
}
