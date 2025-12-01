use bevy_ecs::{component::Component, entity::Entity};
use navara_core::{Extent, Radians};
use navara_feature_component::render::TransferablePolylineGeometry;
use navara_math::FloatType;

use crate::component::WorkerTaskBundle;

#[derive(Component)]
pub struct ConstructPolylineBatchedFeatureMarker;

#[derive(Component, Clone, Debug)]
pub struct ConstructPolylineBatchedFeatureParameters {
    pub batched_feature: Entity,
    /// If it's true, the polyline will be constructed in flat.
    /// This is used to render the polyline as a texture.
    pub flat: bool,
    pub tile_extent: Option<Extent<FloatType, Radians>>,
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
