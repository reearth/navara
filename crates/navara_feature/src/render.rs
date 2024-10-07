use bevy_ecs::{component::Component, entity::Entity};
use navara_buffer_store::Handle;
use navara_core::CRS;
use navara_geometry::TransferableFloatAttribute;
use navara_material::{
    BillboardMaterial, ModelMaterial, PointMaterial, PolygonMaterial, PolylineMaterial,
};
use navara_math::{FloatType, Transform, Vec3};
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
        coordinates: Vec3,
        crs: CRS,
        material: PointMaterial,
        transform: Transform,
        feature_id: Entity,
        render_info: RenderInformation,
    },
    Billboard {
        coordinates: Vec3,
        crs: CRS,
        material: BillboardMaterial,
        transform: Transform,
        feature_id: Entity,
        render_info: RenderInformation,
    },
    Polyline {
        coordinates: Vec3,
        crs: CRS,
        material: PolylineMaterial,
        geometry: TransferablePolylineGeometry,
        transform: Transform,
        feature_id: Entity,
        render_info: RenderInformation,
    },
    Polygon {
        coordinates: Vec3,
        crs: CRS,
        material: PolygonMaterial,
        mesh: Mesh,
        transform: Transform,
        feature_id: Entity,
        render_info: RenderInformation,
    },
    Model {
        coordinates: Vec3,
        crs: CRS,
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
