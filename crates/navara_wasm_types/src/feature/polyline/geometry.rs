use wasm_bindgen::prelude::*;

use crate::{copy_u32_array, ExtentRadianF32, FloatAttribute, UintAttribute};

#[wasm_bindgen]
pub struct ConstructedPolylineGeometry {
    #[wasm_bindgen(getter_with_clone)]
    pub extent: ExtentRadianF32,
    geometry: PolylineGeometry,
}

impl ConstructedPolylineGeometry {
    pub fn new(extent: ExtentRadianF32, geometry: PolylineGeometry) -> Self {
        Self { extent, geometry }
    }
}

#[wasm_bindgen]
impl ConstructedPolylineGeometry {
    pub fn position(&mut self) -> js_sys::Float32Array {
        self.geometry.position()
    }
    pub fn position_size(&mut self) -> u8 {
        self.geometry.position_size()
    }
    pub fn start(&mut self) -> js_sys::Float32Array {
        self.geometry.start()
    }
    pub fn start_size(&mut self) -> u8 {
        self.geometry.start_size()
    }
    pub fn forward_offset(&mut self) -> js_sys::Float32Array {
        self.geometry.forward_offset()
    }
    pub fn forward_offset_size(&mut self) -> u8 {
        self.geometry.forward_offset_size()
    }
    pub fn start_normals(&mut self) -> js_sys::Float32Array {
        self.geometry.start_normals()
    }
    pub fn start_normals_size(&mut self) -> u8 {
        self.geometry.start_normals_size()
    }
    pub fn end_normal_and_texture_coordinate_normalization_x(&mut self) -> js_sys::Float32Array {
        self.geometry
            .end_normal_and_texture_coordinate_normalization_x()
    }
    pub fn end_normal_and_texture_coordinate_normalization_x_size(&mut self) -> u8 {
        self.geometry
            .end_normal_and_texture_coordinate_normalization_x_size()
    }
    pub fn right_normal_and_texture_coordinate_normalization_y(&mut self) -> js_sys::Float32Array {
        self.geometry
            .right_normal_and_texture_coordinate_normalization_y()
    }
    pub fn right_normal_and_texture_coordinate_normalization_y_size(&mut self) -> u8 {
        self.geometry
            .right_normal_and_texture_coordinate_normalization_y_size()
    }
    pub fn batch_id(&mut self) -> Option<js_sys::Float32Array> {
        self.geometry.batch_id()
    }
    pub fn batch_id_size(&mut self) -> Option<u8> {
        self.geometry.batch_id_size()
    }
    pub fn batch_index(&mut self) -> Option<js_sys::Uint32Array> {
        self.geometry.batch_index()
    }
    pub fn batch_index_size(&mut self) -> Option<u8> {
        self.geometry.batch_index_size()
    }
    pub fn indices(&mut self) -> js_sys::Uint32Array {
        self.geometry.indices()
    }
}

#[wasm_bindgen]
#[derive(Clone, Debug, Default, PartialEq)]
pub struct PolylineGeometry {
    attributes: PolylineGeometryAttributes,
    indices: Vec<u32>,
}

impl PolylineGeometry {
    pub fn new(attributes: PolylineGeometryAttributes, indices: Vec<u32>) -> Self {
        Self {
            attributes,
            indices,
        }
    }
}

#[wasm_bindgen]
impl PolylineGeometry {
    pub fn position(&mut self) -> js_sys::Float32Array {
        self.attributes.transfer_position()
    }
    pub fn position_size(&mut self) -> u8 {
        self.attributes.transfer_position_size()
    }
    pub fn start(&mut self) -> js_sys::Float32Array {
        self.attributes.transfer_start()
    }
    pub fn start_size(&mut self) -> u8 {
        self.attributes.transfer_start_size()
    }
    pub fn forward_offset(&mut self) -> js_sys::Float32Array {
        self.attributes.transfer_forward_offset()
    }
    pub fn forward_offset_size(&mut self) -> u8 {
        self.attributes.transfer_forward_offset_size()
    }
    pub fn start_normals(&mut self) -> js_sys::Float32Array {
        self.attributes.transfer_start_normals()
    }
    pub fn start_normals_size(&mut self) -> u8 {
        self.attributes.transfer_start_normals_size()
    }
    pub fn end_normal_and_texture_coordinate_normalization_x(&mut self) -> js_sys::Float32Array {
        self.attributes
            .transfer_end_normal_and_texture_coordinate_normalization_x()
    }
    pub fn end_normal_and_texture_coordinate_normalization_x_size(&mut self) -> u8 {
        self.attributes
            .transfer_end_normal_and_texture_coordinate_normalization_x_size()
    }
    pub fn right_normal_and_texture_coordinate_normalization_y(&mut self) -> js_sys::Float32Array {
        self.attributes
            .transfer_right_normal_and_texture_coordinate_normalization_y()
    }
    pub fn right_normal_and_texture_coordinate_normalization_y_size(&mut self) -> u8 {
        self.attributes
            .transfer_right_normal_and_texture_coordinate_normalization_y_size()
    }
    pub fn batch_id(&mut self) -> Option<js_sys::Float32Array> {
        self.attributes.transfer_batch_id()
    }
    pub fn batch_id_size(&mut self) -> Option<u8> {
        self.attributes.transfer_batch_id_size()
    }
    pub fn batch_index(&mut self) -> Option<js_sys::Uint32Array> {
        self.attributes.transfer_batch_index()
    }
    pub fn batch_index_size(&mut self) -> Option<u8> {
        self.attributes.transfer_batch_index_size()
    }
    pub fn indices(&mut self) -> js_sys::Uint32Array {
        copy_u32_array(&self.indices)
    }
}

#[wasm_bindgen]
#[derive(Clone, Debug, Default, PartialEq)]
pub struct PolylineGeometryAttributes {
    position: FloatAttribute,
    start: FloatAttribute,
    forward_offset: FloatAttribute,
    start_normals: FloatAttribute,
    end_normal_and_texture_coordinate_normalization_x: FloatAttribute,
    right_normal_and_texture_coordinate_normalization_y: FloatAttribute,
    batch_id_and_sel: Option<FloatAttribute>,
    batch_index: Option<UintAttribute>,
}

#[wasm_bindgen]
impl PolylineGeometryAttributes {
    pub fn transfer_position(&mut self) -> js_sys::Float32Array {
        self.position.transfer_data()
    }
    pub fn transfer_position_size(&mut self) -> u8 {
        self.position.size
    }
    pub fn transfer_start(&mut self) -> js_sys::Float32Array {
        self.start.transfer_data()
    }
    pub fn transfer_start_size(&mut self) -> u8 {
        self.start.size
    }
    pub fn transfer_forward_offset(&mut self) -> js_sys::Float32Array {
        self.forward_offset.transfer_data()
    }
    pub fn transfer_forward_offset_size(&mut self) -> u8 {
        self.forward_offset.size
    }
    pub fn transfer_start_normals(&mut self) -> js_sys::Float32Array {
        self.start_normals.transfer_data()
    }
    pub fn transfer_start_normals_size(&mut self) -> u8 {
        self.start_normals.size
    }
    pub fn transfer_end_normal_and_texture_coordinate_normalization_x(
        &mut self,
    ) -> js_sys::Float32Array {
        self.end_normal_and_texture_coordinate_normalization_x
            .transfer_data()
    }
    pub fn transfer_end_normal_and_texture_coordinate_normalization_x_size(&mut self) -> u8 {
        self.end_normal_and_texture_coordinate_normalization_x.size
    }
    pub fn transfer_right_normal_and_texture_coordinate_normalization_y(
        &mut self,
    ) -> js_sys::Float32Array {
        self.right_normal_and_texture_coordinate_normalization_y
            .transfer_data()
    }
    pub fn transfer_right_normal_and_texture_coordinate_normalization_y_size(&mut self) -> u8 {
        self.right_normal_and_texture_coordinate_normalization_y
            .size
    }
    pub fn transfer_batch_id(&mut self) -> Option<js_sys::Float32Array> {
        let Some(batch_id) = &mut self.batch_id_and_sel else {
            return None;
        };
        Some(batch_id.transfer_data())
    }
    pub fn transfer_batch_id_size(&mut self) -> Option<u8> {
        let Some(batch_id) = &mut self.batch_id_and_sel else {
            return None;
        };
        Some(batch_id.size)
    }
    pub fn transfer_batch_index(&mut self) -> Option<js_sys::Uint32Array> {
        let Some(batch_index) = &mut self.batch_index else {
            return None;
        };
        Some(batch_index.transfer_data())
    }
    pub fn transfer_batch_index_size(&mut self) -> Option<u8> {
        let Some(batch_index) = &mut self.batch_index else {
            return None;
        };
        Some(batch_index.size)
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
            batch_id_and_sel: val.batch_id_and_sel.map(|v| v.into()),
            batch_index: val.batch_index.map(|v| v.into()),
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
            batch_id_and_sel: val.batch_id_and_sel.map(|v| v.into()),
            batch_index: val.batch_index.map(|v| v.into()),
        }
    }
}
