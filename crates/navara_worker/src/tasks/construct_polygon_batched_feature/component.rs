use bevy_ecs::{component::Component, entity::Entity};
use navara_core::{Extent, Radians};
use navara_feature_component::render::TransferablePolygonGeometry;
use navara_math::{FloatType, Vec3};

use crate::component::WorkerTaskBundle;

#[derive(Component)]
pub struct ConstructPolygonBatchedFeatureMarker;

#[derive(Component, Clone, Debug)]
pub struct ConstructPolygonBatchedFeatureParameters {
    pub batched_feature: Entity,
    /// If it's true, the polygon will be constructed in flat.
    /// This is used to render the polygon as a texture.
    pub flat: bool,
    pub tile_extent: Option<Extent<FloatType, Radians>>,
}

#[derive(Component, Clone, Debug)]
pub struct ConstructPolygonBatchedFeatureResult {
    pub extent: Option<Extent<FloatType, Radians>>,
    pub geometry: TransferablePolygonGeometry,
    /// RTC (Relative-To-Center) translation vector
    /// Contains the tile center in world-space ECEF coordinates
    pub rtc_translation: Option<Vec3>,
}

pub type ConstructPolygonBatchedFeatureWorkerTaskBundle = WorkerTaskBundle<
    ConstructPolygonBatchedFeatureMarker,
    ConstructPolygonBatchedFeatureParameters,
>;
