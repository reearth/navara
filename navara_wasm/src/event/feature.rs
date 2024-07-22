use serde::Serialize;
use wasm_bindgen::prelude::*;

use crate::{
    appearance::{
        BillboardMaterial, ModelMaterial, PointMaterial, PolygonMaterial, PolylineMaterial,
    },
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
    pub mesh: Mesh,
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

impl<'a> From<&'a navara_ecs::map::feature::render::RenderableFeature> for RenderableFeature {
    fn from(v: &'a navara_ecs::map::feature::render::RenderableFeature) -> Self {
        match v {
            navara_ecs::map::feature::render::RenderableFeature::Point {
                material,
                transform,
            } => Self {
                point: Some(PointMesh {
                    material: material.into(),
                    transform: transform.into(),
                }),
                ..Default::default()
            },
            navara_ecs::map::feature::render::RenderableFeature::Billboard {
                material,
                transform,
            } => Self {
                billboard: Some(BillboardMesh {
                    material: material.into(),
                    transform: transform.into(),
                }),
                ..Default::default()
            },
            navara_ecs::map::feature::render::RenderableFeature::Polyline {
                material,
                mesh,
                transform,
            } => Self {
                polyline: Some(PolylineMesh {
                    material: material.into(),
                    mesh: mesh.into(),
                    transform: transform.into(),
                }),
                ..Default::default()
            },
            navara_ecs::map::feature::render::RenderableFeature::Polygon {
                material,
                mesh,
                transform,
            } => Self {
                polygon: Some(PolygonMesh {
                    material: material.into(),
                    mesh: mesh.into(),
                    transform: transform.into(),
                }),
                ..Default::default()
            },
            navara_ecs::map::feature::render::RenderableFeature::Model {
                material,
                transform,
            } => Self {
                model: Some(ModelMesh {
                    material: material.into(),
                    transform: transform.into(),
                }),
                ..Default::default()
            },
            navara_ecs::map::feature::render::RenderableFeature::Unknown => unreachable!(),
        }
    }
}
