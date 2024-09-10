use bevy_ecs::component::Component;
use navara_math::FloatType;

#[derive(Debug, Clone, PartialEq, Default, Component)]
pub struct TilesLayer {
    pub url: String,
    pub segments: usize,
    pub color: u32,
    pub max_sse: FloatType,
    pub max_z: usize,
    pub wireframe: bool,
}
