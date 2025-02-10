use bevy_ecs::component::Component;
use navara_math::FloatType;

#[derive(Component)]
pub struct Fog {
    pub enabled: bool,
    pub density: FloatType,
    pub sse_factor: FloatType,
}
