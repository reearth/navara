use bevy_ecs::component::Component;
use navara_math::FloatType;

#[derive(Component, Clone)]
pub struct Fog {
    pub enabled: bool,
    pub density: FloatType,
    pub sse_factor: FloatType,
}
