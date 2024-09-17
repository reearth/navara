use bevy_ecs::component::Component;
use navara_core::CRS;
use navara_math::Vec3;

#[derive(Component)]
pub struct PolylineMarker;

#[derive(Component)]
pub struct PolylineGeometry {
    pub coords: Vec<Vec3>,
    pub crs: CRS,
}
