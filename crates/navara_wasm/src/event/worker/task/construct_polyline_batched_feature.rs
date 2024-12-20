use navara_wasm_types::ExtentRadianF32;
use serde::Serialize;
use wasm_bindgen::prelude::*;

use crate::{entity::ReconstructableEntity, geometry::TransferablePolylineGeometry};

#[wasm_bindgen]
#[derive(Clone, Debug, Serialize)]
pub struct ConstructPolylineBatchedFeatureParameters {
    #[wasm_bindgen(getter_with_clone)]
    pub batched_feature: ReconstructableEntity,
}

impl<'a> From<&'a navara_worker::construct_polyline_batched_feature::ConstructPolylineBatchedFeatureParameters>
    for ConstructPolylineBatchedFeatureParameters
{
    fn from(
        val: &'a navara_worker::construct_polyline_batched_feature::ConstructPolylineBatchedFeatureParameters,
    ) -> ConstructPolylineBatchedFeatureParameters {
        ConstructPolylineBatchedFeatureParameters {
            batched_feature: ReconstructableEntity(val.batched_feature.to_bits()),
        }
    }
}

#[wasm_bindgen]
#[derive(Clone, Debug, Serialize)]
pub struct ConstructPolylineBatchedFeatureResult {
    #[wasm_bindgen(getter_with_clone)]
    pub geometry: TransferablePolylineGeometry,
    #[wasm_bindgen(getter_with_clone)]
    pub extent: ExtentRadianF32,
}

#[wasm_bindgen]
impl ConstructPolylineBatchedFeatureResult {
    #[wasm_bindgen(constructor)]
    pub fn new(geometry: TransferablePolylineGeometry, extent: ExtentRadianF32) -> Self {
        Self { geometry, extent }
    }
}

impl From<ConstructPolylineBatchedFeatureResult>
    for navara_worker::construct_polyline_batched_feature::ConstructPolylineBatchedFeatureResult
{
    fn from(val: ConstructPolylineBatchedFeatureResult) -> Self {
        navara_worker::construct_polyline_batched_feature::ConstructPolylineBatchedFeatureResult {
            geometry: val.geometry.into(),
            extent: val.extent.into(),
        }
    }
}
impl<'a>
    From<
        &'a navara_worker::construct_polyline_batched_feature::ConstructPolylineBatchedFeatureResult,
    > for ConstructPolylineBatchedFeatureResult
{
    fn from(
        val: &'a navara_worker::construct_polyline_batched_feature::ConstructPolylineBatchedFeatureResult,
    ) -> ConstructPolylineBatchedFeatureResult {
        ConstructPolylineBatchedFeatureResult {
            geometry: (&val.geometry).into(),
            extent: (&val.extent).into(),
        }
    }
}
