use bevy_ecs::{
    query::QueryState,
    system::{Query, Resource, SystemState},
    world::World,
};
use navara_feature_component::batch::BatchedFeature;
use navara_material::PolygonMaterial;

/// Following [Bevy documentation](https://docs.rs/bevy/latest/bevy/ecs/system/struct.SystemState.html#warning), the system state should be cached.
#[derive(Resource)]
pub struct CachedPolygonBatchedFeatureSystemState {
    state: SystemState<(
        Query<'static, 'static, &'static BatchedFeature>,
        Query<
            'static,
            'static,
            (
                &'static navara_feature_component::polygon::PolygonGeometry,
                &'static PolygonMaterial,
                &'static navara_feature_component::batch::BatchId,
            ),
        >,
    )>,
}
