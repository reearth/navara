use crate::WorkerTaskMarker;
use bevy_ecs::{
    entity::Entity,
    query::{Added, With, Without},
    system::{Commands, Query, ResMut},
};
use navara_buffer_store::BufferStore;
use navara_component::Deleted;
use navara_core::{Extent, Radians};
use navara_feature_component::render::TransferablePolygonGeometry;
use navara_geometry::{FloatAttribute, Hierarchy, PolygonGeometryAttributes, PolygonResource};
use navara_material::PolygonMaterial;
use navara_math::FloatType;

use super::{ConstructPolygonBatchedFeatureParameters, ConstructPolygonBatchedFeatureResult};

/// Construct polygon geometry from per-feature child entities on a worker thread.
///
/// TODO: Implement this system when we support Bevy rendering engine.
#[allow(clippy::type_complexity)]
pub(crate) fn construct_polygon_batched_feature(
    _commands: Commands,
    _polygon_resource: ResMut<PolygonResource>,
    _buf: ResMut<BufferStore>,
    _polygon: Query<(
        &navara_feature_component::polygon::PolygonGeometry,
        &PolygonMaterial,
        &navara_feature_component::batch::BatchId,
    )>,
    _constructors: Query<
        (Entity, &ConstructPolygonBatchedFeatureParameters),
        (
            Added<WorkerTaskMarker>,
            With<WorkerTaskMarker>,
            Without<Deleted>,
        ),
    >,
) {
}
