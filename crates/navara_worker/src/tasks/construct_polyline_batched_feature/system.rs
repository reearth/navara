use crate::WorkerTaskMarker;
use bevy_ecs::{
    entity::Entity,
    query::{Added, With, Without},
    system::{Commands, Query, ResMut},
};
use navara_buffer_store::BufferStore;
use navara_component::Deleted;
use navara_feature_component::polyline::PolylineGeometry;
use navara_material::PolylineMaterial;

use super::{ConstructPolylineBatchedFeatureParameters, ConstructPolylineBatchedFeatureResult};

/// Construct polyline geometry from per-feature child entities on a worker thread.
///
/// TODO: Implement this system when we support Bevy rendering engine.
#[allow(clippy::type_complexity)]
pub(crate) fn construct_polyline_batched_feature(
    _commands: Commands,
    _buf: ResMut<BufferStore>,
    _polylines: Query<(
        &PolylineGeometry,
        &PolylineMaterial,
        &navara_feature_component::batch::BatchId,
    )>,
    _constructors: Query<
        (Entity, &ConstructPolylineBatchedFeatureParameters),
        (
            Added<WorkerTaskMarker>,
            With<WorkerTaskMarker>,
            Without<Deleted>,
        ),
    >,
) {
}
