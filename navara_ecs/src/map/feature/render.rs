use bevy_ecs::component::Component;
use bevy_math::Vec3;
use bevy_transform::components::Transform;
use navara_layer::{
    BillboardMaterial, ModelMaterial, PointMaterial, PolygonMaterial, PolylineMaterial,
};

use crate::Mesh;

#[derive(Clone, Debug, Default, PartialEq)]
pub struct RenderInformation {
    pub current_terrain_height: f32,
}

#[derive(Component, Clone, Debug, Default, PartialEq)]
pub enum RenderableFeature {
    Point {
        material: PointMaterial,
        transform: Transform,
        coordinates: Vec3, // lng, lat, height
        render_info: RenderInformation,
    },
    Billboard {
        material: BillboardMaterial,
        transform: Transform,
        coordinates: Vec3, // lng, lat, height
        render_info: RenderInformation,
    },
    Polyline {
        material: PolylineMaterial,
        mesh: Mesh,
        transform: Transform,
        render_info: RenderInformation,
    },
    Polygon {
        material: PolygonMaterial,
        mesh: Mesh,
        transform: Transform,
        render_info: RenderInformation,
    },
    Model {
        material: ModelMaterial,
        transform: Transform,
        render_info: RenderInformation,
    },
    #[default]
    Unknown,
}
