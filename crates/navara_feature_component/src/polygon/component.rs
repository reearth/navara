use bevy_ecs::{component::Component, entity::Entity};
use navara_core::CRS;
use navara_geometry::TransferableHierarchy;
use navara_material::PolygonMaterial;

#[derive(Component)]
pub struct PolygonMarker;

#[derive(Component, Debug)]
pub struct PolygonGeometry {
    pub hierarchy: TransferableHierarchy,
    pub crs: CRS,
}

#[derive(Component)]
pub struct UpdatePolygon {
    pub material: PolygonMaterial,
    pub feature_id: Entity,
}
