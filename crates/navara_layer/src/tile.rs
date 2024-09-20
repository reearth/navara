use bevy_ecs::component::Component;

#[derive(Debug, Clone, PartialEq, Default, Component)]
pub struct TilesLayer {
    pub layer_id: String,
    pub url: String,
    pub segments: usize,
    pub color: u32,
    pub max_sse: f32,
    pub max_z: usize,
    pub wireframe: bool,
}
