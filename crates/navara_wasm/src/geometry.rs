use navara_buffer_store::Handle;
use serde::Serialize;
use wasm_bindgen::prelude::*;

use crate::attribute::TransferableFloatAttribute;

#[wasm_bindgen]
#[derive(Debug, Clone, Serialize)]
pub struct TransferableGeometry {
    pub vertices: Handle,
    pub uvs: Handle,
    pub indices: Handle,
}

#[wasm_bindgen]
impl TransferableGeometry {
    #[wasm_bindgen(constructor)]
    pub fn new(vertices: Handle, uvs: Handle, indices: Handle) -> Self {
        Self {
            vertices,
            uvs,
            indices,
        }
    }
}

impl From<TransferableGeometry> for navara_geometry::TransferableGeometry {
    fn from(val: TransferableGeometry) -> Self {
        navara_geometry::TransferableGeometry {
            vertices: val.vertices,
            uvs: val.uvs,
            indices: val.indices,
        }
    }
}
impl<'a> From<&'a navara_geometry::TransferableGeometry> for TransferableGeometry {
    fn from(val: &'a navara_geometry::TransferableGeometry) -> Self {
        TransferableGeometry {
            vertices: val.vertices,
            uvs: val.uvs,
            indices: val.indices,
        }
    }
}

#[wasm_bindgen]
#[derive(Debug, Clone, Serialize)]
pub struct TransferablePolylineGeometry {
    #[wasm_bindgen(getter_with_clone)]
    pub position: TransferableFloatAttribute,
    #[wasm_bindgen(getter_with_clone)]
    pub start: TransferableFloatAttribute,
    #[wasm_bindgen(getter_with_clone)]
    pub forward_offset: TransferableFloatAttribute,
    #[wasm_bindgen(getter_with_clone)]
    pub start_normals: TransferableFloatAttribute,
    #[wasm_bindgen(getter_with_clone)]
    pub end_normal_and_texture_coordinate_normalization_x: TransferableFloatAttribute,
    #[wasm_bindgen(getter_with_clone)]
    pub right_normal_and_texture_coordinate_normalization_y: TransferableFloatAttribute,
    #[wasm_bindgen(getter_with_clone)]
    pub batch_id: Option<TransferableFloatAttribute>,
    #[wasm_bindgen(getter_with_clone)]
    pub indices: Handle,
}

#[wasm_bindgen]
impl TransferablePolylineGeometry {
    #[allow(clippy::too_many_arguments)]
    #[wasm_bindgen(constructor)]
    pub fn new(
        position: TransferableFloatAttribute,
        start: TransferableFloatAttribute,
        forward_offset: TransferableFloatAttribute,
        start_normals: TransferableFloatAttribute,
        end_normal_and_texture_coordinate_normalization_x: TransferableFloatAttribute,
        right_normal_and_texture_coordinate_normalization_y: TransferableFloatAttribute,
        batch_id: Option<TransferableFloatAttribute>,
        indices: Handle,
    ) -> Self {
        Self {
            position,
            start,
            forward_offset,
            start_normals,
            end_normal_and_texture_coordinate_normalization_x,
            right_normal_and_texture_coordinate_normalization_y,
            batch_id,
            indices,
        }
    }
}

impl From<TransferablePolylineGeometry>
    for navara_feature_component::render::TransferablePolylineGeometry
{
    fn from(val: TransferablePolylineGeometry) -> Self {
        navara_feature_component::render::TransferablePolylineGeometry {
            position: val.position.into(),
            start: val.start.into(),
            forward_offset: val.forward_offset.into(),
            start_normals: val.start_normals.into(),
            end_normal_and_texture_coordinate_normalization_x: val
                .end_normal_and_texture_coordinate_normalization_x
                .into(),
            right_normal_and_texture_coordinate_normalization_y: val
                .right_normal_and_texture_coordinate_normalization_y
                .into(),
            batch_id: val.batch_id.map(|b| b.into()),
            indices: val.indices,
        }
    }
}
impl<'a> From<&'a navara_feature_component::render::TransferablePolylineGeometry>
    for TransferablePolylineGeometry
{
    fn from(
        val: &'a navara_feature_component::render::TransferablePolylineGeometry,
    ) -> TransferablePolylineGeometry {
        TransferablePolylineGeometry {
            position: (&val.position).into(),
            start: (&val.start).into(),
            forward_offset: (&val.forward_offset).into(),
            start_normals: (&val.start_normals).into(),
            end_normal_and_texture_coordinate_normalization_x: (&val
                .end_normal_and_texture_coordinate_normalization_x)
                .into(),
            right_normal_and_texture_coordinate_normalization_y: (&val
                .right_normal_and_texture_coordinate_normalization_y)
                .into(),
            batch_id: val.batch_id.as_ref().map(|b| b.into()),
            indices: val.indices,
        }
    }
}

#[wasm_bindgen]
#[derive(Debug, Clone, Serialize)]
pub struct TransferablePolygonGeometry {
    #[wasm_bindgen(getter_with_clone)]
    pub position: TransferableFloatAttribute,
    #[wasm_bindgen(getter_with_clone)]
    pub normal: Option<TransferableFloatAttribute>,
    #[wasm_bindgen(getter_with_clone)]
    pub scale_normal_and_cap: Option<TransferableFloatAttribute>,
    #[wasm_bindgen(getter_with_clone)]
    pub batch_id: Option<TransferableFloatAttribute>,
    #[wasm_bindgen(getter_with_clone)]
    pub indices: Handle,
}

#[wasm_bindgen]
impl TransferablePolygonGeometry {
    #[wasm_bindgen(constructor)]
    pub fn new(
        position: TransferableFloatAttribute,
        normal: Option<TransferableFloatAttribute>,
        scale_normal_and_cap: Option<TransferableFloatAttribute>,
        batch_id: Option<TransferableFloatAttribute>,
        indices: Handle,
    ) -> Self {
        Self {
            position,
            normal,
            scale_normal_and_cap,
            batch_id,
            indices,
        }
    }
}

impl From<TransferablePolygonGeometry>
    for navara_feature_component::render::TransferablePolygonGeometry
{
    fn from(val: TransferablePolygonGeometry) -> Self {
        navara_feature_component::render::TransferablePolygonGeometry {
            position: val.position.into(),
            normal: val.normal.map(|n| n.into()),
            scale_normal_and_cap: val.scale_normal_and_cap.map(|n| n.into()),
            batch_id: val.batch_id.map(|n| n.into()),
            indices: val.indices,
        }
    }
}
impl<'a> From<&'a navara_feature_component::render::TransferablePolygonGeometry>
    for TransferablePolygonGeometry
{
    fn from(
        val: &'a navara_feature_component::render::TransferablePolygonGeometry,
    ) -> TransferablePolygonGeometry {
        TransferablePolygonGeometry {
            position: (&val.position).into(),
            normal: val.normal.as_ref().map(|n| n.into()),
            scale_normal_and_cap: val.scale_normal_and_cap.as_ref().map(|n| n.into()),
            batch_id: val.batch_id.as_ref().map(|n| n.into()),
            indices: val.indices,
        }
    }
}

#[wasm_bindgen]
#[derive(Debug, Clone, Serialize)]
pub struct TransferableSingleGeometry {
    #[wasm_bindgen(getter_with_clone)]
    pub batch_id: Option<u32>,
}

impl From<TransferableSingleGeometry>
    for navara_feature_component::render::TransferableSingleGeometry
{
    fn from(val: TransferableSingleGeometry) -> Self {
        navara_feature_component::render::TransferableSingleGeometry {
            batch_id: val.batch_id,
        }
    }
}
impl<'a> From<&'a navara_feature_component::render::TransferableSingleGeometry>
    for TransferableSingleGeometry
{
    fn from(
        val: &'a navara_feature_component::render::TransferableSingleGeometry,
    ) -> TransferableSingleGeometry {
        TransferableSingleGeometry {
            batch_id: val.batch_id,
        }
    }
}

#[wasm_bindgen]
#[derive(Debug, Clone, Serialize)]
pub struct TransferableModelGeometry {
    #[wasm_bindgen(getter_with_clone)]
    pub batch_id_and_selected_status: Option<TransferableFloatAttribute>,
}

impl From<TransferableModelGeometry>
    for navara_feature_component::render::TransferableModelGeometry
{
    fn from(val: TransferableModelGeometry) -> Self {
        navara_feature_component::render::TransferableModelGeometry {
            batch_id_and_selected_status: val.batch_id_and_selected_status.map(|b| b.into()),
        }
    }
}
impl<'a> From<&'a navara_feature_component::render::TransferableModelGeometry>
    for TransferableModelGeometry
{
    fn from(
        val: &'a navara_feature_component::render::TransferableModelGeometry,
    ) -> TransferableModelGeometry {
        TransferableModelGeometry {
            batch_id_and_selected_status: val
                .batch_id_and_selected_status
                .as_ref()
                .map(|b| b.into()),
        }
    }
}
