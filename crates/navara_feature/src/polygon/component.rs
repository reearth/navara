use bevy_ecs::{component::Component, entity::Entity};
use navara_core::CRS;
use navara_geometry::Hierarchy;
use navara_material::PolygonMaterial;

#[derive(Component)]
pub struct PolygonMarker;

#[derive(Component, Debug)]
pub struct PolygonGeometry {
    pub hierarchy: Hierarchy,
    pub crs: CRS,
}

#[derive(Component)]
pub struct UpdatePolygon {
    pub material: PolygonMaterial,
    pub feature_id: Entity,
}

#[derive(Component, Debug)]
pub struct BatchedFeature {
    pub features: Vec<Entity>,
}

#[derive(Component, Debug)]
pub struct BatchId(pub usize);
