use navara_wasm_types::ExtentRadianF32;
use serde::Serialize;
use wasm_bindgen::prelude::*;

use crate::{entity::ReconstructableEntity, geometry::TransferablePolylineGeometry};

#[wasm_bindgen]
#[derive(Clone, Debug, Serialize)]
pub struct ConstructPolylineBatchedFeatureParameters {
    #[wasm_bindgen(getter_with_clone)]
    pub batched_feature: ReconstructableEntity,
    pub flat: bool,
    tile_extent: Option<ExtentRadianF32>,
}

#[wasm_bindgen]
impl ConstructPolylineBatchedFeatureParameters {
    #[wasm_bindgen(getter)]
    pub fn tile_extent(&self) -> Option<ExtentRadianF32> {
        self.tile_extent
    }
}

impl<'a> From<&'a navara_worker::construct_polyline_batched_feature::ConstructPolylineBatchedFeatureParameters>
    for ConstructPolylineBatchedFeatureParameters
{
    fn from(
        val: &'a navara_worker::construct_polyline_batched_feature::ConstructPolylineBatchedFeatureParameters,
    ) -> ConstructPolylineBatchedFeatureParameters {
        ConstructPolylineBatchedFeatureParameters {
            batched_feature: ReconstructableEntity(val.batched_feature.to_bits()),
            flat: val.flat,
            tile_extent: val.tile_extent.as_ref().map(|e| e.into()),
        }
    }
}

#[wasm_bindgen]
#[derive(Clone, Debug, Serialize)]
pub struct ConstructPolylineBatchedFeatureResult {
    #[wasm_bindgen(getter_with_clone)]
    pub geometry: TransferablePolylineGeometry,
    extent: Option<ExtentRadianF32>,
}

#[wasm_bindgen]
impl ConstructPolylineBatchedFeatureResult {
    #[wasm_bindgen(constructor)]
    pub fn new(geometry: TransferablePolylineGeometry, extent: Option<ExtentRadianF32>) -> Self {
        Self { geometry, extent }
    }

    #[wasm_bindgen(getter)]
    pub fn extent(&self) -> Option<ExtentRadianF32> {
        self.extent
    }
}

impl From<ConstructPolylineBatchedFeatureResult>
    for navara_worker::construct_polyline_batched_feature::ConstructPolylineBatchedFeatureResult
{
    fn from(val: ConstructPolylineBatchedFeatureResult) -> Self {
        navara_worker::construct_polyline_batched_feature::ConstructPolylineBatchedFeatureResult {
            geometry: val.geometry.into(),
            extent: val.extent.map(|e| e.into()).unwrap_or_default(),
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
            extent: Some((&val.extent).into()),
        }
    }
}
