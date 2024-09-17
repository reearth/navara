use bevy_ecs::{component::Component, entity::Entity};
use navara_buffer_store::Handle;
use navara_geometry::TransferableFloatAttribute;
use navara_layer::{
    BillboardMaterial, ModelMaterial, PointMaterial, PolygonMaterial, PolylineMaterial,
};
use navara_math::Transform;
use navara_mesh::Mesh;

#[derive(Clone, Debug, Default, PartialEq)]
pub struct RenderInformation {
    pub current_terrain_height: f32,
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
        geometry: TransferablePolylineGeometry,
        transform: Transform,
        feature_id: Entity,
        render_info: RenderInformation,
    },
    Polygon {
        material: PolygonMaterial,
        mesh: Mesh,
        transform: Transform,
        feature_id: Entity,
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

#[derive(Component, Clone, Debug, Default, PartialEq)]
pub struct TransferablePolylineGeometry {
    pub position: TransferableFloatAttribute,
    pub start: TransferableFloatAttribute,
    pub forward_offset: TransferableFloatAttribute,
    pub start_normals: TransferableFloatAttribute,
    pub end_normal_and_texture_coordinate_normalization_x: TransferableFloatAttribute,
    pub right_normal_and_texture_coordinate_normalization_y: TransferableFloatAttribute,
    pub indices: Handle,
}
