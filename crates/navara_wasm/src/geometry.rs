use navara_buffer_store::Handle;
use serde::Serialize;
use wasm_bindgen::prelude::*;

use crate::attribute::TransferableFloatAttribute;

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
    pub indices: Handle,
}

impl From<TransferablePolylineGeometry> for navara_feature::render::TransferablePolylineGeometry {
    fn from(val: TransferablePolylineGeometry) -> Self {
        navara_feature::render::TransferablePolylineGeometry {
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
            indices: val.indices,
        }
    }
}
impl<'a> From<&'a navara_feature::render::TransferablePolylineGeometry>
    for TransferablePolylineGeometry
{
    fn from(
        val: &'a navara_feature::render::TransferablePolylineGeometry,
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
            indices: val.indices,
        }
    }
}
