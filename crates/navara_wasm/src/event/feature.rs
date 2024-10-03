use serde::Serialize;
use wasm_bindgen::prelude::*;

use crate::{
    appearance::{
        BillboardMaterial, ModelMaterial, PointMaterial, PolygonMaterial, PolylineMaterial,
    },
    geometry::TransferablePolylineGeometry,
    Mesh, Transform,
};

#[wasm_bindgen]
#[derive(Debug, Clone, Serialize)]
pub struct PointMesh {
    #[wasm_bindgen(getter_with_clone)]
    pub material: PointMaterial,
    pub transform: Transform,
}

#[wasm_bindgen]
#[derive(Debug, Clone, Serialize)]
pub struct BillboardMesh {
    #[wasm_bindgen(getter_with_clone)]
    pub material: BillboardMaterial,
    pub transform: Transform,
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
    pub mesh: Mesh,
    pub transform: Transform,
}

#[wasm_bindgen]
#[derive(Debug, Clone, Serialize)]
pub struct ModelMesh {
    #[wasm_bindgen(getter_with_clone)]
    pub material: ModelMaterial,
    pub transform: Transform,
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

impl<'a> From<&'a navara_feature::render::RenderableFeature> for RenderableFeature {
    fn from(v: &'a navara_feature::render::RenderableFeature) -> Self {
        match v {
            navara_feature::render::RenderableFeature::Point {
                coordinates: _,
                crs: _,
                material,
                transform,
                feature_id: _,
                render_info: _,
            } => Self {
                point: Some(PointMesh {
                    material: material.into(),
                    transform: transform.into(),
                }),
                ..Default::default()
            },
            navara_feature::render::RenderableFeature::Billboard {
                coordinates: _,
                crs: _,
                material,
                transform,
                feature_id: _,
                render_info: _,
            } => Self {
                billboard: Some(BillboardMesh {
                    material: material.into(),
                    transform: transform.into(),
                }),
                ..Default::default()
            },
            navara_feature::render::RenderableFeature::Polyline {
                coordinates: _,
                crs: _,
                material,
                transform,
                geometry,
                feature_id: _,
                render_info: _,
            } => Self {
                polyline: Some(PolylineMesh {
                    material: material.into(),
                    geometry: geometry.into(),
                    transform: transform.into(),
                }),
                ..Default::default()
            },
            navara_feature::render::RenderableFeature::Polygon {
                coordinates: _,
                crs: _,
                material,
                mesh,
                transform,
                feature_id: _,
                render_info: _,
            } => Self {
                polygon: Some(PolygonMesh {
                    material: material.into(),
                    mesh: mesh.into(),
                    transform: transform.into(),
                }),
                ..Default::default()
            },
            navara_feature::render::RenderableFeature::Model {
                coordinates: _,
                crs: _,
                material,
                transform,
                feature_id: _,
                render_info: _,
            } => Self {
                model: Some(ModelMesh {
                    material: material.into(),
                    transform: transform.into(),
                }),
                ..Default::default()
            },
            navara_feature::render::RenderableFeature::Unknown => unreachable!(),
        }
    }
}
