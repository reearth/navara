use wasm_bindgen::prelude::*;

use crate::{consume_vec, ExtentRadianF32, FloatAttribute};

#[wasm_bindgen]
pub struct ConstructedPolylineGeometry {
    #[wasm_bindgen(getter_with_clone)]
    pub extent: ExtentRadianF32,
    #[wasm_bindgen(getter_with_clone)]
    pub geometry: PolylineGeometry,
}

#[wasm_bindgen]
impl ConstructedPolylineGeometry {
    #[wasm_bindgen(js_name = "transferGeometry")]
    pub fn transfer_geometry(&mut self) -> PolylineGeometry {
        PolylineGeometry {
            attributes: self.geometry.transfer_attributes(),
            indices: self.geometry.transfer_indices(),
        }
    }
}

#[wasm_bindgen]
#[derive(Clone, Debug, Default, PartialEq)]
pub struct PolylineGeometry {
    #[wasm_bindgen(getter_with_clone)]
    pub attributes: PolylineGeometryAttributes,
    #[wasm_bindgen(getter_with_clone)]
    pub indices: Vec<u32>,
}

#[wasm_bindgen]
impl PolylineGeometry {
    #[wasm_bindgen(js_name = "transferAttributes")]
    pub fn transfer_attributes(&mut self) -> PolylineGeometryAttributes {
        PolylineGeometryAttributes {
            position: self.attributes.transfer_position(),
            forward_offset: self.attributes.transfer_forward_offset(),
            start: self.attributes.transfer_start(),
            start_normals: self.attributes.transfer_start_normals(),
            end_normal_and_texture_coordinate_normalization_x: self
                .attributes
                .transfer_end_normal_and_texture_coordinate_normalization_x(),
            right_normal_and_texture_coordinate_normalization_y: self
                .attributes
                .transfer_right_normal_and_texture_coordinate_normalization_y(),
            batch_id: self.attributes.transfer_batch_id(),
        }
    }

    #[wasm_bindgen(js_name = "transferIndices")]
    pub fn transfer_indices(&mut self) -> Vec<u32> {
        consume_vec(&mut self.indices)
    }
}

#[wasm_bindgen]
#[derive(Clone, Debug, Default, PartialEq)]
pub struct PolylineGeometryAttributes {
    #[wasm_bindgen(getter_with_clone)]
    pub position: FloatAttribute,
    #[wasm_bindgen(getter_with_clone)]
    pub start: FloatAttribute,
    #[wasm_bindgen(getter_with_clone)]
    pub forward_offset: FloatAttribute,
    #[wasm_bindgen(getter_with_clone)]
    pub start_normals: FloatAttribute,
    #[wasm_bindgen(getter_with_clone)]
    pub end_normal_and_texture_coordinate_normalization_x: FloatAttribute,
    #[wasm_bindgen(getter_with_clone)]
    pub right_normal_and_texture_coordinate_normalization_y: FloatAttribute,
    #[wasm_bindgen(getter_with_clone)]
    pub batch_id: Option<FloatAttribute>,
}

#[wasm_bindgen]
impl PolylineGeometryAttributes {
    #[wasm_bindgen(js_name = "transferPosition")]
    pub fn transfer_position(&mut self) -> FloatAttribute {
        FloatAttribute {
            data: self.position.transfer_data(),
            size: self.position.size,
        }
    }
    #[wasm_bindgen(js_name = "transferStart")]
    pub fn transfer_start(&mut self) -> FloatAttribute {
        FloatAttribute {
            data: self.start.transfer_data(),
            size: self.start.size,
        }
    }
    #[wasm_bindgen(js_name = "transferForwardOffset")]
    pub fn transfer_forward_offset(&mut self) -> FloatAttribute {
        FloatAttribute {
            data: self.forward_offset.transfer_data(),
            size: self.forward_offset.size,
        }
    }
    #[wasm_bindgen(js_name = "transferStartNormals")]
    pub fn transfer_start_normals(&mut self) -> FloatAttribute {
        FloatAttribute {
            data: self.start_normals.transfer_data(),
            size: self.start_normals.size,
        }
    }
    #[wasm_bindgen(js_name = "transferEndNormalAndTextureCoordinateNormalizationX")]
    pub fn transfer_end_normal_and_texture_coordinate_normalization_x(&mut self) -> FloatAttribute {
        FloatAttribute {
            data: self
                .end_normal_and_texture_coordinate_normalization_x
                .transfer_data(),
            size: self.end_normal_and_texture_coordinate_normalization_x.size,
        }
    }
    #[wasm_bindgen(js_name = "transferRightNormalAndTextureCoordinateNormalizationY")]
    pub fn transfer_right_normal_and_texture_coordinate_normalization_y(
        &mut self,
    ) -> FloatAttribute {
        FloatAttribute {
            data: self
                .right_normal_and_texture_coordinate_normalization_y
                .transfer_data(),
            size: self
                .right_normal_and_texture_coordinate_normalization_y
                .size,
        }
    }
    #[wasm_bindgen(js_name = "transferBatchId")]
    pub fn transfer_batch_id(&mut self) -> Option<FloatAttribute> {
        let Some(batch_id) = &mut self.batch_id else {
            return None;
        };
        Some(FloatAttribute {
            data: batch_id.transfer_data(),
            size: batch_id.size,
        })
    }
}

impl From<PolylineGeometryAttributes> for navara_geometry::PolylineGeometryAttributes {
    fn from(val: PolylineGeometryAttributes) -> Self {
        navara_geometry::PolylineGeometryAttributes {
            position: val.position.into(),
            start: val.start.into(),
            start_normals: val.start_normals.into(),
            forward_offset: val.forward_offset.into(),
            end_normal_and_texture_coordinate_normalization_x: val
                .end_normal_and_texture_coordinate_normalization_x
                .into(),
            right_normal_and_texture_coordinate_normalization_y: val
                .right_normal_and_texture_coordinate_normalization_y
                .into(),
            batch_id: val.batch_id.map(|v| v.into()),
        }
    }
}
impl From<navara_geometry::PolylineGeometryAttributes> for PolylineGeometryAttributes {
    fn from(val: navara_geometry::PolylineGeometryAttributes) -> Self {
        PolylineGeometryAttributes {
            position: val.position.into(),
            start: val.start.into(),
            start_normals: val.start_normals.into(),
            forward_offset: val.forward_offset.into(),
            end_normal_and_texture_coordinate_normalization_x: val
                .end_normal_and_texture_coordinate_normalization_x
                .into(),
            right_normal_and_texture_coordinate_normalization_y: val
                .right_normal_and_texture_coordinate_normalization_y
                .into(),
            batch_id: val.batch_id.map(|v| v.into()),
        }
    }
}
