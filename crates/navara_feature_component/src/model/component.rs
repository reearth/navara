use bevy_ecs::component::Component;
use navara_buffer_store::Handle;
use navara_core::CRS;
use navara_math::Vec3;

#[derive(Component)]
pub struct ModelMarker;

#[derive(Component)]
pub struct ModelGeometry {
    pub coords: Vec3,
    pub crs: CRS,
}

#[derive(Clone, Debug, Default, PartialEq, Component)]
pub struct ModelBin(pub Handle);
