use bevy_ecs::{component::Component, entity::Entity, system::ResMut};
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
pub struct ModelRenderInformation {
    pub current_terrain_height: FloatType,
    pub is_rendered: bool,
}

#[derive(Clone, Debug, Default, PartialEq)]
pub struct PolygonRenderInformation {
    pub should_recalculate_height: bool,
    pub distance_to_center_from_ellipsoid_surface: FloatType,
}

#[derive(Clone, Debug, Default, PartialEq)]
pub struct PolylineRenderInformation {
    pub should_recalculate_height: bool,
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
        geometry: TransferableSingleGeometry,
    },
    Billboard {
        coordinates: Vec3,
        crs: CRS,
        material: BillboardMaterial,
        transform: Transform,
        feature_id: Entity,
        render_info: RenderInformation,
        geometry: TransferableSingleGeometry,
    },
    Polyline {
        coordinates: Vec3,
        crs: CRS,
        material: PolylineMaterial,
        geometry: TransferablePolylineGeometry,
        transform: Transform,
        feature_id: Option<Entity>,
        render_info: PolylineRenderInformation,
        extent: Extent<f32, Radians>,
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
        render_info: ModelRenderInformation,
        bin: Option<ModelBin>,
        geometry: TransferableSingleGeometry,
    },
    #[default]
    Unknown,
}

impl RenderableFeature {
    pub fn destroy(&mut self, buf: &mut BufferStore) {
        match self {
            RenderableFeature::Polyline { geometry, .. } => {
                geometry.remove_from_buf(buf);
            }
            RenderableFeature::Polygon { geometry, .. } => {
                geometry.remove_from_buf(buf);
            }
            _ => (),
        }
    }
}

#[derive(Component, Clone, Debug, Default, PartialEq)]
pub struct TransferablePolylineGeometry {
    pub position: TransferableFloatAttribute,
    pub start: TransferableFloatAttribute,
    pub forward_offset: TransferableFloatAttribute,
    pub start_normals: TransferableFloatAttribute,
    pub end_normal_and_texture_coordinate_normalization_x: TransferableFloatAttribute,
    pub right_normal_and_texture_coordinate_normalization_y: TransferableFloatAttribute,
    pub batch_id: Option<TransferableFloatAttribute>,
    pub indices: Handle,
}

impl TransferablePolylineGeometry {
    pub fn with_buf(
        buf: &mut ResMut<BufferStore>,
        geo: navara_geometry::PolylineGeometry,
    ) -> TransferablePolylineGeometry {
        let position = buf.new_f32(geo.attributes.position.data);
        let start = buf.new_f32(geo.attributes.start.data);
        let forward_offset = buf.new_f32(geo.attributes.forward_offset.data);
        let start_normals = buf.new_f32(geo.attributes.start_normals.data);
        let end_normal_and_texture_coordinate_normalization_x = buf.new_f32(
            geo.attributes
                .end_normal_and_texture_coordinate_normalization_x
                .data,
        );
        let right_normal_and_texture_coordinate_normalization_y = buf.new_f32(
            geo.attributes
                .right_normal_and_texture_coordinate_normalization_y
                .data,
        );
        let indices = buf.new_u32(geo.indices);

        TransferablePolylineGeometry {
            position: TransferableFloatAttribute {
                data: position,
                size: geo.attributes.position.size,
            },
            start: TransferableFloatAttribute {
                data: start,
                size: geo.attributes.start.size,
            },
            forward_offset: TransferableFloatAttribute {
                data: forward_offset,
                size: geo.attributes.forward_offset.size,
            },
            start_normals: TransferableFloatAttribute {
                data: start_normals,
                size: geo.attributes.start_normals.size,
            },
            end_normal_and_texture_coordinate_normalization_x: TransferableFloatAttribute {
                data: end_normal_and_texture_coordinate_normalization_x,
                size: geo
                    .attributes
                    .end_normal_and_texture_coordinate_normalization_x
                    .size,
            },
            right_normal_and_texture_coordinate_normalization_y: TransferableFloatAttribute {
                data: right_normal_and_texture_coordinate_normalization_y,
                size: geo
                    .attributes
                    .right_normal_and_texture_coordinate_normalization_y
                    .size,
            },
            batch_id: geo
                .attributes
                .batch_id
                .map(|batch_id| TransferableFloatAttribute {
                    data: buf.new_f32(batch_id.data),
                    size: batch_id.size,
                }),
            indices,
        }
    }

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
        if let Some(batch_id) = &self.batch_id {
            buf.remove(&batch_id.data);
        }
        buf.remove(&self.indices);
    }
}

#[derive(Component, Clone, Debug, Default, PartialEq)]
pub struct TransferablePolygonGeometry {
    pub position: TransferableFloatAttribute,
    pub normal: Option<TransferableFloatAttribute>,
    pub scale_normal_and_cap: Option<TransferableFloatAttribute>,
    pub batch_id: Option<TransferableFloatAttribute>,
    pub indices: Handle,
}

impl TransferablePolygonGeometry {
    pub fn with_buf(
        buf: &mut BufferStore,
        geo: navara_geometry::PolygonGeometry,
    ) -> TransferablePolygonGeometry {
        let position = buf.new_f32(geo.attributes.position.data);
        let normal = geo.attributes.normal.map(|n| (buf.new_f32(n.data), n.size));
        let scale_normal_and_cap = geo
            .attributes
            .scale_normal_and_cap
            .map(|n| (buf.new_f32(n.data), n.size));
        let batch_id = geo
            .attributes
            .batch_id
            .map(|n| (buf.new_f32(n.data), n.size));
        let indices = buf.new_u32(geo.indices);

        TransferablePolygonGeometry {
            position: TransferableFloatAttribute {
                data: position,
                size: geo.attributes.position.size,
            },
            normal: normal.map(|(normal, size)| TransferableFloatAttribute { data: normal, size }),
            scale_normal_and_cap: scale_normal_and_cap.map(|(scale_normal_and_cap, size)| {
                TransferableFloatAttribute {
                    data: scale_normal_and_cap,
                    size,
                }
            }),
            batch_id: batch_id.map(|(batch_id, size)| TransferableFloatAttribute {
                data: batch_id,
                size,
            }),
            indices,
        }
    }
}

impl TransferablePolygonGeometry {
    pub fn remove_from_buf(&mut self, buf: &mut BufferStore) {
        buf.remove(&self.position.data);
        buf.remove(&self.indices);

        if let Some(normal) = &self.normal {
            buf.remove(&normal.data);
        }
        if let Some(normal) = &self.scale_normal_and_cap {
            buf.remove(&normal.data);
        }
        if let Some(batch_id) = &self.batch_id {
            buf.remove(&batch_id.data);
        }
    }
}

#[derive(Component, Clone, Debug, Default, PartialEq)]
pub struct TransferableSingleGeometry {
    pub batch_id: Option<u32>,
}
