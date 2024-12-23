use navara_buffer_store::Handle;
use serde::Serialize;
use wasm_bindgen::prelude::*;

use crate::{
    geometry::{
        TransferablePolygonGeometry, TransferablePolylineGeometry, TransferableSingleGeometry,
    },
    Transform,
};
use navara_wasm_types::{
    polygon::TransferablePolygonBatchedFeature, polyline::TransferablePolylineBatchedFeature,
    BillboardMaterial, ModelMaterial, PointMaterial, PolygonMaterial, PolylineMaterial,
};

#[wasm_bindgen]
#[derive(Debug, Clone, Serialize)]
pub struct PointMesh {
    #[wasm_bindgen(getter_with_clone)]
    pub material: PointMaterial,
    pub transform: Transform,
    #[wasm_bindgen(getter_with_clone)]
    pub geometry: TransferableSingleGeometry,
}

#[wasm_bindgen]
#[derive(Debug, Clone, Serialize)]
pub struct BillboardMesh {
    #[wasm_bindgen(getter_with_clone)]
    pub material: BillboardMaterial,
    pub transform: Transform,
    #[wasm_bindgen(getter_with_clone)]
    pub geometry: TransferableSingleGeometry,
}

#[wasm_bindgen]
#[derive(Debug, Clone, Serialize)]
pub struct PolylineMesh {
    #[wasm_bindgen(getter_with_clone)]
    pub material: PolylineMaterial,
    #[wasm_bindgen(getter_with_clone)]
    pub geometry: TransferablePolylineGeometry,
    pub transform: Transform,
}

#[wasm_bindgen]
#[derive(Debug, Clone, Serialize)]
pub struct PolygonMesh {
    #[wasm_bindgen(getter_with_clone)]
    pub material: PolygonMaterial,
    #[wasm_bindgen(getter_with_clone)]
    pub geometry: TransferablePolygonGeometry,
    pub transform: Transform,
}

#[wasm_bindgen]
#[derive(Debug, Clone, Serialize)]
pub struct ModelMesh {
    #[wasm_bindgen(getter_with_clone)]
    pub material: ModelMaterial,
    pub transform: Transform,
    pub bin: Option<Handle>,
    #[wasm_bindgen(getter_with_clone)]
    pub geometry: TransferableSingleGeometry,
}

#[wasm_bindgen]
#[derive(Debug, Clone, Default, Serialize)]
pub struct RenderableFeature {
    #[wasm_bindgen(getter_with_clone)]
    pub point: Option<PointMesh>,
    #[wasm_bindgen(getter_with_clone)]
    pub billboard: Option<BillboardMesh>,
    #[wasm_bindgen(getter_with_clone)]
    pub polyline: Option<PolylineMesh>,
    #[wasm_bindgen(getter_with_clone)]
    pub polygon: Option<PolygonMesh>,
    #[wasm_bindgen(getter_with_clone)]
    pub model: Option<ModelMesh>,
}

impl<'a> From<&'a navara_feature_component::render::RenderableFeature> for RenderableFeature {
    fn from(v: &'a navara_feature_component::render::RenderableFeature) -> Self {
        match v {
            navara_feature_component::render::RenderableFeature::Point {
                coordinates: _,
                crs: _,
                material,
                transform,
                feature_id: _,
                render_info: _,
                geometry,
            } => Self {
                point: Some(PointMesh {
                    material: material.into(),
                    transform: transform.into(),
                    geometry: geometry.into(),
                }),
                ..Default::default()
            },
            navara_feature_component::render::RenderableFeature::Billboard {
                coordinates: _,
                crs: _,
                material,
                transform,
                feature_id: _,
                render_info: _,
                geometry,
            } => Self {
                billboard: Some(BillboardMesh {
                    material: material.into(),
                    transform: transform.into(),
                    geometry: geometry.into(),
                }),
                ..Default::default()
            },
            navara_feature_component::render::RenderableFeature::Polyline {
                coordinates: _,
                crs: _,
                material,
                transform,
                geometry,
                feature_id: _,
                render_info: _,
                extent: _,
            } => Self {
                polyline: Some(PolylineMesh {
                    material: material.into(),
                    geometry: geometry.into(),
                    transform: transform.into(),
                }),
                ..Default::default()
            },
            navara_feature_component::render::RenderableFeature::Polygon {
                coordinates: _,
                crs: _,
                material,
                geometry,
                transform,
                feature_id: _,
                render_info: _,
                extent: _,
            } => Self {
                polygon: Some(PolygonMesh {
                    material: material.into(),
                    geometry: geometry.into(),
                    transform: transform.into(),
                }),
                ..Default::default()
            },
            navara_feature_component::render::RenderableFeature::Model {
                coordinates: _,
                crs: _,
                material,
                transform,
                feature_id: _,
                render_info: _,
                bin,
                geometry,
            } => Self {
                model: Some(ModelMesh {
                    material: material.into(),
                    transform: transform.into(),
                    bin: bin.as_ref().map(|v| v.0),
                    geometry: geometry.into(),
                }),
                ..Default::default()
            },
            navara_feature_component::render::RenderableFeature::Unknown => unreachable!(),
        }
    }
}

#[wasm_bindgen]
pub struct ReturnedTransferablePolygonBatchedFeature {
    pub(crate) transferable: TransferablePolygonBatchedFeature,
    #[wasm_bindgen(getter_with_clone)]
    pub material: PolygonMaterial,
}

#[wasm_bindgen]
impl ReturnedTransferablePolygonBatchedFeature {
    pub fn transferable(&mut self) -> TransferablePolygonBatchedFeature {
        self.transferable.consume()
    }
}

#[wasm_bindgen]
pub struct ReturnedTransferablePolylineBatchedFeature {
    pub(crate) transferable: TransferablePolylineBatchedFeature,
    #[wasm_bindgen(getter_with_clone)]
    pub material: PolylineMaterial,
}

#[wasm_bindgen]
impl ReturnedTransferablePolylineBatchedFeature {
    pub fn transferable(&mut self) -> TransferablePolylineBatchedFeature {
        self.transferable.consume()
    }
}
