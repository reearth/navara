use bevy_ecs::component::Component;
use navara_core::CRS;
use navara_geometry::Hierarchy;

#[derive(Component)]
pub struct PolygonMarker;

#[derive(Component)]
pub struct PolygonGeometry {
    pub hierarchy: Hierarchy,
    pub crs: CRS,
}
