use bevy_ecs::entity::Entity;

#[derive(Debug, Default)]
pub struct TerrainData {
    pub(crate) data_requester_entity_id: Option<Entity>,
    pub(crate) upsampled_mesh_entity_id: Option<Entity>,
}

impl TerrainData {
    pub(crate) fn is_upsampled(&self) -> bool {
        self.upsampled_mesh_entity_id.is_some()
    }
}
