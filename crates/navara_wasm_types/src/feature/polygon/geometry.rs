use wasm_bindgen::prelude::*;

use crate::{copy_u32_array, ExtentRadianF32, FloatAttribute, UintAttribute};

#[wasm_bindgen]
pub struct ConstructedPolygonGeometry {
    #[wasm_bindgen(getter_with_clone)]
    geometry: PolygonGeometry,
    pub extent: Option<ExtentRadianF32>,
}

impl ConstructedPolygonGeometry {
    pub fn new(geometry: PolygonGeometry, extent: Option<ExtentRadianF32>) -> Self {
        Self { geometry, extent }
    }
}

#[wasm_bindgen]
impl ConstructedPolygonGeometry {
    pub fn position_3d_high(&mut self) -> Option<js_sys::Float32Array> {
        self.geometry.position_3d_high()
    }
    pub fn position_3d_high_size(&mut self) -> Option<u8> {
        self.geometry.position_3d_high_size()
    }
    pub fn position_3d_low(&mut self) -> Option<js_sys::Float32Array> {
        self.geometry.position_3d_low()
    }
    pub fn position_3d_low_size(&mut self) -> Option<u8> {
        self.geometry.position_3d_low_size()
    }
    pub fn position(&mut self) -> Option<js_sys::Float32Array> {
        self.geometry.position()
    }
    pub fn position_size(&mut self) -> Option<u8> {
        self.geometry.position_size()
    }
    pub fn normal(&mut self) -> Option<js_sys::Float32Array> {
        self.geometry.normal()
    }
    pub fn normal_size(&mut self) -> Option<u8> {
        self.geometry.normal_size()
    }
    pub fn scale_normal_and_cap(&mut self) -> Option<js_sys::Float32Array> {
        self.geometry.scale_normal_and_cap()
    }
    pub fn scale_normal_and_cap_size(&mut self) -> Option<u8> {
        self.geometry.scale_normal_and_cap_size()
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
pub struct PolygonGeometry {
    attributes: PolygonGeometryAttributes,
    indices: Vec<u32>,
}

impl PolygonGeometry {
    pub fn new(attributes: PolygonGeometryAttributes, indices: Vec<u32>) -> Self {
        Self {
            attributes,
            indices,
        }
    }
}

#[wasm_bindgen]
impl PolygonGeometry {
    pub fn position_3d_high(&mut self) -> Option<js_sys::Float32Array> {
        self.attributes.transfer_position_3d_high()
    }
    pub fn position_3d_high_size(&mut self) -> Option<u8> {
        self.attributes.transfer_position_3d_high_size()
    }
    pub fn position_3d_low(&mut self) -> Option<js_sys::Float32Array> {
        self.attributes.transfer_position_3d_low()
    }
    pub fn position_3d_low_size(&mut self) -> Option<u8> {
        self.attributes.transfer_position_3d_low_size()
    }
    pub fn position(&mut self) -> Option<js_sys::Float32Array> {
        self.attributes.transfer_position()
    }
    pub fn position_size(&mut self) -> Option<u8> {
        self.attributes.transfer_position_size()
    }
    pub fn normal(&mut self) -> Option<js_sys::Float32Array> {
        self.attributes.transfer_normal()
    }
    pub fn normal_size(&mut self) -> Option<u8> {
        self.attributes.transfer_normal_size()
    }
    pub fn scale_normal_and_cap(&mut self) -> Option<js_sys::Float32Array> {
        self.attributes.transfer_scale_normal_and_cap()
    }
    pub fn scale_normal_and_cap_size(&mut self) -> Option<u8> {
        self.attributes.transfer_scale_normal_and_cap_size()
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
pub struct PolygonGeometryAttributes {
    position: Option<FloatAttribute>,
    position_3d_high: Option<FloatAttribute>,
    position_3d_low: Option<FloatAttribute>,
    normal: Option<FloatAttribute>,
    scale_normal_and_cap: Option<FloatAttribute>,
    batch_ids: Option<FloatAttribute>,
    batch_index: Option<UintAttribute>,
}

#[wasm_bindgen]
impl PolygonGeometryAttributes {
    pub fn transfer_position_3d_high(&mut self) -> Option<js_sys::Float32Array> {
        self.position_3d_high.as_mut().map(|p| p.transfer_data())
    }
    pub fn transfer_position_3d_high_size(&mut self) -> Option<u8> {
        self.position_3d_high.as_ref().map(|p| p.size)
    }
    pub fn transfer_position_3d_low(&mut self) -> Option<js_sys::Float32Array> {
        self.position_3d_low.as_mut().map(|p| p.transfer_data())
    }
    pub fn transfer_position_3d_low_size(&mut self) -> Option<u8> {
        self.position_3d_low.as_ref().map(|p| p.size)
    }
    pub fn transfer_position(&mut self) -> Option<js_sys::Float32Array> {
        self.position.as_mut().map(|p| p.transfer_data())
    }
    pub fn transfer_position_size(&mut self) -> Option<u8> {
        self.position.as_ref().map(|p| p.size)
    }
    pub fn transfer_normal(&mut self) -> Option<js_sys::Float32Array> {
        let Some(normal) = &mut self.normal else {
            return None;
        };
        Some(normal.transfer_data())
    }
    pub fn transfer_normal_size(&mut self) -> Option<u8> {
        let Some(normal) = &mut self.normal else {
            return None;
        };
        Some(normal.size)
    }
    pub fn transfer_scale_normal_and_cap(&mut self) -> Option<js_sys::Float32Array> {
        let Some(scale_normal_and_cap) = &mut self.scale_normal_and_cap else {
            return None;
        };
        Some(scale_normal_and_cap.transfer_data())
    }
    pub fn transfer_scale_normal_and_cap_size(&mut self) -> Option<u8> {
        let Some(scale_normal_and_cap) = &mut self.scale_normal_and_cap else {
            return None;
        };
        Some(scale_normal_and_cap.size)
    }
    pub fn transfer_batch_id(&mut self) -> Option<js_sys::Float32Array> {
        let Some(batch_ids) = &mut self.batch_ids else {
            return None;
        };
        Some(batch_ids.transfer_data())
    }
    pub fn transfer_batch_id_size(&mut self) -> Option<u8> {
        let Some(batch_ids) = &mut self.batch_ids else {
            return None;
        };
        Some(batch_ids.size)
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

impl From<PolygonGeometryAttributes> for navara_geometry::PolygonGeometryAttributes {
    fn from(val: PolygonGeometryAttributes) -> Self {
        navara_geometry::PolygonGeometryAttributes {
            position: val.position.map(|v| v.into()),
            position_3d_high: val.position_3d_high.map(|v| v.into()),
            position_3d_low: val.position_3d_low.map(|v| v.into()),
            normal: val.normal.map(|v| v.into()),
            scale_normal_and_cap: val.scale_normal_and_cap.map(|v| v.into()),
            batch_ids: val.batch_ids.map(|v| v.into()),
            batch_index: val.batch_index.map(|v| v.into()),
        }
    }
}
impl From<navara_geometry::PolygonGeometryAttributes> for PolygonGeometryAttributes {
    fn from(val: navara_geometry::PolygonGeometryAttributes) -> Self {
        PolygonGeometryAttributes {
            position: val.position.map(|v| v.into()),
            position_3d_high: val.position_3d_high.map(|v| v.into()),
            position_3d_low: val.position_3d_low.map(|v| v.into()),
            normal: val.normal.map(|v| v.into()),
            scale_normal_and_cap: val.scale_normal_and_cap.map(|v| v.into()),
            batch_ids: val.batch_ids.map(|v| v.into()),
            batch_index: val.batch_index.map(|v| v.into()),
        }
    }
}
