use navara_wasm_types::ExtentRadianF32;
use serde::Serialize;
use wasm_bindgen::prelude::*;

use crate::{entity::ReconstructableEntity, geometry::TransferablePolygonGeometry};

#[wasm_bindgen]
#[derive(Clone, Debug, Serialize)]
pub struct ConstructPolygonBatchedFeatureParameters {
    #[wasm_bindgen(getter_with_clone)]
    pub batched_feature: ReconstructableEntity,
}

impl<'a> From<&'a navara_worker::construct_polygon_batched_feature::ConstructPolygonBatchedFeatureParameters>
    for ConstructPolygonBatchedFeatureParameters
{
    fn from(
        val: &'a navara_worker::construct_polygon_batched_feature::ConstructPolygonBatchedFeatureParameters,
    ) -> ConstructPolygonBatchedFeatureParameters {
        ConstructPolygonBatchedFeatureParameters {
            batched_feature: ReconstructableEntity(val.batched_feature.to_bits()),
        }
    }
}

#[wasm_bindgen]
#[derive(Clone, Debug, Serialize)]
pub struct ConstructPolygonBatchedFeatureResult {
    #[wasm_bindgen(getter_with_clone)]
    pub geometry: TransferablePolygonGeometry,
    #[wasm_bindgen(getter_with_clone)]
    pub extent: ExtentRadianF32,
}

#[wasm_bindgen]
impl ConstructPolygonBatchedFeatureResult {
    #[wasm_bindgen(constructor)]
    pub fn new(geometry: TransferablePolygonGeometry, extent: ExtentRadianF32) -> Self {
        Self { geometry, extent }
    }
}

impl From<ConstructPolygonBatchedFeatureResult>
    for navara_worker::construct_polygon_batched_feature::ConstructPolygonBatchedFeatureResult
{
    fn from(val: ConstructPolygonBatchedFeatureResult) -> Self {
        navara_worker::construct_polygon_batched_feature::ConstructPolygonBatchedFeatureResult {
            geometry: val.geometry.into(),
            extent: val.extent.into(),
        }
    }
}
impl<'a>
    From<&'a navara_worker::construct_polygon_batched_feature::ConstructPolygonBatchedFeatureResult>
    for ConstructPolygonBatchedFeatureResult
{
    fn from(
        val: &'a navara_worker::construct_polygon_batched_feature::ConstructPolygonBatchedFeatureResult,
    ) -> ConstructPolygonBatchedFeatureResult {
        ConstructPolygonBatchedFeatureResult {
            geometry: (&val.geometry).into(),
            extent: (&val.extent).into(),
        }
    }
}
