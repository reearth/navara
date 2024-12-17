use bevy_ecs::{component::Component, entity::Entity};
use navara_core::{Extent, Radians};
use navara_feature_component::render::TransferablePolygonGeometry;
use navara_math::FloatType;
use serde::Serialize;

use crate::component::WorkerTaskBundle;

#[derive(Component)]
pub struct ConstructPolygonBatchedFeatureMarker;

#[derive(Component, Clone, Debug, Serialize)]
pub struct ConstructPolygonBatchedFeatureParameters {
    pub batched_feature: Entity,
}

#[derive(Component, Clone, Debug)]
pub struct ConstructPolygonBatchedFeatureResult {
    pub extent: Extent<FloatType, Radians>,
    pub geometry: TransferablePolygonGeometry,
}

pub type ConstructPolygonBatchedFeatureWorkerTaskBundle = WorkerTaskBundle<
    ConstructPolygonBatchedFeatureMarker,
    ConstructPolygonBatchedFeatureParameters,
>;
