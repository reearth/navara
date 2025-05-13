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
    /// If it's true, the polygon will be constructed in flat.
    /// This is used to render the polygon as a texture.
    pub flat: bool,
}

#[derive(Component, Clone, Debug)]
pub struct ConstructPolygonBatchedFeatureResult {
    pub extent: Option<Extent<FloatType, Radians>>,
    pub geometry: TransferablePolygonGeometry,
}

pub type ConstructPolygonBatchedFeatureWorkerTaskBundle = WorkerTaskBundle<
    ConstructPolygonBatchedFeatureMarker,
    ConstructPolygonBatchedFeatureParameters,
>;
