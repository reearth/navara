use wasm_bindgen::prelude::*;

use crate::{copy_u32_array, ExtentRadianF32, FloatAttribute};

#[wasm_bindgen]
pub struct ConstructedPolygonGeometry {
    #[wasm_bindgen(getter_with_clone)]
    pub extent: ExtentRadianF32,
    geometry: PolygonGeometry,
}

impl ConstructedPolygonGeometry {
    pub fn new(extent: ExtentRadianF32, geometry: PolygonGeometry) -> Self {
        Self { extent, geometry }
    }
}

#[wasm_bindgen]
impl ConstructedPolygonGeometry {
    pub fn position(&mut self) -> js_sys::Float32Array {
        self.geometry.position()
    }
    pub fn position_size(&mut self) -> u8 {
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
    pub fn extruded_height(&mut self) -> Option<js_sys::Float32Array> {
        self.geometry.extruded_height()
    }
    pub fn extruded_height_size(&mut self) -> Option<u8> {
        self.geometry.extruded_height_size()
    }
    pub fn indices(&mut self) -> js_sys::Uint32Array {
        self.geometry.indices()
    }

    pub fn drop(self) {
        self.geometry.drop();
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
    pub fn position(&mut self) -> js_sys::Float32Array {
        self.attributes.transfer_position()
    }
    pub fn position_size(&mut self) -> u8 {
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
    pub fn extruded_height(&mut self) -> Option<js_sys::Float32Array> {
        self.attributes.transfer_extruded_height()
    }
    pub fn extruded_height_size(&mut self) -> Option<u8> {
        self.attributes.transfer_extruded_height_size()
    }
    pub fn indices(&mut self) -> js_sys::Uint32Array {
        copy_u32_array(&self.indices)
    }

    pub fn drop(self) {
        self.attributes.drop();
        drop(self.indices);
    }
}

#[wasm_bindgen]
#[derive(Clone, Debug, Default, PartialEq)]
pub struct PolygonGeometryAttributes {
    position: FloatAttribute,
    normal: Option<FloatAttribute>,
    scale_normal_and_cap: Option<FloatAttribute>,
    batch_id: Option<FloatAttribute>,
    extruded_height: Option<FloatAttribute>,
}

#[wasm_bindgen]
impl PolygonGeometryAttributes {
    pub fn transfer_position(&mut self) -> js_sys::Float32Array {
        self.position.transfer_data()
    }
    pub fn transfer_position_size(&mut self) -> u8 {
        self.position.size
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
        let Some(batch_id) = &mut self.batch_id else {
            return None;
        };
        Some(batch_id.transfer_data())
    }
    pub fn transfer_batch_id_size(&mut self) -> Option<u8> {
        let Some(batch_id) = &mut self.batch_id else {
            return None;
        };
        Some(batch_id.size)
    }
    pub fn transfer_extruded_height(&mut self) -> Option<js_sys::Float32Array> {
        let Some(extruded_height) = &mut self.extruded_height else {
            return None;
        };
        Some(extruded_height.transfer_data())
    }
    pub fn transfer_extruded_height_size(&mut self) -> Option<u8> {
        let Some(extruded_height) = &mut self.extruded_height else {
            return None;
        };
        Some(extruded_height.size)
    }

    pub fn drop(self) {
        drop(self.position.data);
        drop(self.normal.unwrap().data);
        drop(self.scale_normal_and_cap.unwrap().data);
        drop(self.batch_id.unwrap().data);
    }
}

impl From<PolygonGeometryAttributes> for navara_geometry::PolygonGeometryAttributes {
    fn from(val: PolygonGeometryAttributes) -> Self {
        navara_geometry::PolygonGeometryAttributes {
            position: val.position.into(),
            normal: val.normal.map(|v| v.into()),
            scale_normal_and_cap: val.scale_normal_and_cap.map(|v| v.into()),
            batch_id: val.batch_id.map(|v| v.into()),
            extruded_height: val.extruded_height.map(|v| v.into()),
        }
    }
}
impl From<navara_geometry::PolygonGeometryAttributes> for PolygonGeometryAttributes {
    fn from(val: navara_geometry::PolygonGeometryAttributes) -> Self {
        PolygonGeometryAttributes {
            position: val.position.into(),
            normal: val.normal.map(|v| v.into()),
            scale_normal_and_cap: val.scale_normal_and_cap.map(|v| v.into()),
            batch_id: val.batch_id.map(|v| v.into()),
            extruded_height: val.extruded_height.map(|v| v.into()),
        }
    }
}
