use bevy_ecs::{component::Component, entity::Entity};
use navara_core::{Extent, Radians};
use navara_feature_component::render::TransferablePolylineGeometry;
use navara_math::FloatType;
use serde::Serialize;

use crate::component::WorkerTaskBundle;

#[derive(Component)]
pub struct ConstructPolylineBatchedFeatureMarker;

#[derive(Component, Clone, Debug, Serialize)]
pub struct ConstructPolylineBatchedFeatureParameters {
    pub batched_feature: Entity,
}

#[derive(Component, Clone, Debug)]
pub struct ConstructPolylineBatchedFeatureResult {
    pub extent: Extent<FloatType, Radians>,
    pub geometry: TransferablePolylineGeometry,
}

pub type ConstructPolylineBatchedFeatureWorkerTaskBundle = WorkerTaskBundle<
    ConstructPolylineBatchedFeatureMarker,
    ConstructPolylineBatchedFeatureParameters,
>;
