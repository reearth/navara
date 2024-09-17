use bevy_ecs::{component::Component, entity::Entity};
use navara_layer::{
    BillboardMaterial, ModelMaterial, PointMaterial, PolygonMaterial, PolylineMaterial,
};
use navara_math::{FloatType, Transform};
use navara_mesh::Mesh;

#[derive(Clone, Debug, Default, PartialEq)]
pub struct RenderInformation {
    pub current_terrain_height: FloatType,
}

// From data oriented design perspective, this is too bad structure.
// But this is necessary to communicate with WASM.
#[derive(Component, Clone, Debug, Default, PartialEq)]
pub enum RenderableFeature {
    Point {
        material: PointMaterial,
        transform: Transform,
        feature_id: Entity,
        render_info: RenderInformation,
    },
    Billboard {
        material: BillboardMaterial,
        transform: Transform,
        feature_id: Entity,
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
        feature_id: Entity,
        render_info: RenderInformation,
    },
    #[default]
    Unknown,
}
