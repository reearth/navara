use bevy_ecs::component::Component;
use navara_core::CRS;
use navara_math::Vec3;

#[derive(Component)]
pub struct BillboardMarker;

#[derive(Component)]
pub struct BillboardGeometry {
    pub coords: Vec3,
    pub crs: CRS,
}
