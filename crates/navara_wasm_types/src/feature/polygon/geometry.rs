use wasm_bindgen::prelude::*;

use crate::{consume_vec, ExtentRadianF32, FloatAttribute};

#[wasm_bindgen]
pub struct ConstructedPolygonGeometry {
    #[wasm_bindgen(getter_with_clone)]
    pub extent: ExtentRadianF32,
    #[wasm_bindgen(getter_with_clone)]
    pub geometry: PolygonGeometry,
}

#[wasm_bindgen]
impl ConstructedPolygonGeometry {
    #[wasm_bindgen(js_name = "transferGeometry")]
    pub fn transfer_geometry(&mut self) -> PolygonGeometry {
        PolygonGeometry {
            attributes: self.geometry.transfer_attributes(),
            indices: self.geometry.transfer_indices(),
        }
    }
}

#[wasm_bindgen]
#[derive(Clone, Debug, Default, PartialEq)]
pub struct PolygonGeometry {
    #[wasm_bindgen(getter_with_clone)]
    pub attributes: PolygonGeometryAttributes,
    #[wasm_bindgen(getter_with_clone)]
    pub indices: Vec<u32>,
}

#[wasm_bindgen]
impl PolygonGeometry {
    #[wasm_bindgen(js_name = "transferAttributes")]
    pub fn transfer_attributes(&mut self) -> PolygonGeometryAttributes {
        PolygonGeometryAttributes {
            position: self.attributes.transfer_position(),
            normal: self.attributes.transfer_normal(),
            scale_normal_and_cap: self.attributes.transfer_scale_normal_and_cap(),
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
pub struct PolygonGeometryAttributes {
    #[wasm_bindgen(getter_with_clone)]
    pub position: FloatAttribute,
    #[wasm_bindgen(getter_with_clone)]
    pub normal: Option<FloatAttribute>,
    #[wasm_bindgen(getter_with_clone)]
    pub scale_normal_and_cap: Option<FloatAttribute>,
    #[wasm_bindgen(getter_with_clone)]
    pub batch_id: Option<FloatAttribute>,
}

#[wasm_bindgen]
impl PolygonGeometryAttributes {
    #[wasm_bindgen(js_name = "transferPosition")]
    pub fn transfer_position(&mut self) -> FloatAttribute {
        FloatAttribute {
            data: self.position.transfer_data(),
            size: self.position.size,
        }
    }
    #[wasm_bindgen(js_name = "transferNormal")]
    pub fn transfer_normal(&mut self) -> Option<FloatAttribute> {
        let Some(normal) = &mut self.normal else {
            return None;
        };
        Some(FloatAttribute {
            data: normal.transfer_data(),
            size: normal.size,
        })
    }
    #[wasm_bindgen(js_name = "transferScaleNormalAndCap")]
    pub fn transfer_scale_normal_and_cap(&mut self) -> Option<FloatAttribute> {
        let Some(scale_normal_and_cap) = &mut self.scale_normal_and_cap else {
            return None;
        };
        Some(FloatAttribute {
            data: scale_normal_and_cap.transfer_data(),
            size: scale_normal_and_cap.size,
        })
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

impl From<PolygonGeometryAttributes> for navara_geometry::PolygonGeometryAttributes {
    fn from(val: PolygonGeometryAttributes) -> Self {
        navara_geometry::PolygonGeometryAttributes {
            position: val.position.into(),
            normal: val.normal.map(|v| v.into()),
            scale_normal_and_cap: val.scale_normal_and_cap.map(|v| v.into()),
            batch_id: val.batch_id.map(|v| v.into()),
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
        }
    }
}
