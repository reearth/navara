use bevy_ecs::component::Component;
use bevy_transform::components::Transform;
use navara_layer::{
    BillboardMaterial, ModelMaterial, PointMaterial, PolygonMaterial, PolylineMaterial,
};

use crate::Mesh;

#[derive(Component, Clone, Debug, Default, PartialEq)]
pub enum RenderableFeature {
    Point {
        material: PointMaterial,
        transform: Transform,
    },
    Billboard {
        material: BillboardMaterial,
        transform: Transform,
    },
    Polyline {
        material: PolylineMaterial,
        mesh: Mesh,
        transform: Transform,
    },
    Polygon {
        material: PolygonMaterial,
        mesh: Mesh,
        transform: Transform,
    },
    Model {
        material: ModelMaterial,
        transform: Transform,
    },
    #[default]
    Unknown,
}
