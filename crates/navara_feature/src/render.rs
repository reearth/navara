use bevy_ecs::{component::Component, entity::Entity};
use navara_buffer_store::{BufferStore, Handle};
use navara_core::{Extent, Radians, CRS};
use navara_geometry::TransferableFloatAttribute;
use navara_material::{
    BillboardMaterial, ModelMaterial, PointMaterial, PolygonMaterial, PolylineMaterial,
};
use navara_math::{FloatType, Transform, Vec3};

use crate::model::ModelBin;

#[derive(Clone, Debug, Default, PartialEq)]
pub struct RenderInformation {
    pub current_terrain_height: FloatType,
}

#[derive(Clone, Debug, Default, PartialEq)]
pub struct PolygonRenderInformation {
    pub should_recalculate_height: bool,
    pub distance_to_center_from_ellipsoid_surface: FloatType,
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
        geometry: TransferablePolygonGeometry,
        transform: Transform,
        feature_id: Option<Entity>,
        render_info: PolygonRenderInformation,
        extent: Extent<f32, Radians>,
    },
    Model {
        coordinates: Vec3,
        crs: CRS,
        material: ModelMaterial,
        transform: Transform,
        feature_id: Entity,
        render_info: RenderInformation,
        bin: Option<ModelBin>,
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

impl TransferablePolylineGeometry {
    pub fn remove_from_buf(&mut self, buf: &mut BufferStore) {
        buf.remove(&self.position.data);
        buf.remove(&self.start.data);
        buf.remove(&self.forward_offset.data);
        buf.remove(&self.start_normals.data);
        buf.remove(&self.end_normal_and_texture_coordinate_normalization_x.data);
        buf.remove(
            &self
                .right_normal_and_texture_coordinate_normalization_y
                .data,
        );
        buf.remove(&self.indices);
    }
}

#[derive(Component, Clone, Debug, Default, PartialEq)]
pub struct TransferablePolygonGeometry {
    pub position: TransferableFloatAttribute,
    pub normal: Option<TransferableFloatAttribute>,
    pub scale_normal_and_cap: Option<TransferableFloatAttribute>,
    pub indices: Handle,
}

impl TransferablePolygonGeometry {
    pub fn remove_from_buf(&mut self, buf: &mut BufferStore) {
        buf.remove(&self.position.data);
        buf.remove(&self.indices);

        if let Some(normal) = &self.normal {
            buf.remove(&normal.data);
        }
    }
}
