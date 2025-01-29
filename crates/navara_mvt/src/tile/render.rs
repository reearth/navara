use bevy_ecs::{
    component::Component,
    entity::Entity,
    system::{Commands, Query},
};

use navara_buffer_store::BufferStore;
use navara_feature_component::{
    batch::BatchId, batch::BatchTable, batch::BatchedFeature, id::FeatureId,
    render::RenderableFeature,
};
use navara_tile_component::TileHandle;

#[derive(Component, Default)]
pub struct RenderedTile {
    pub(crate) tile_handle: TileHandle,
    pub(crate) feature_ids: Option<Vec<Entity>>,
}

impl RenderedTile {
    #[allow(clippy::too_many_arguments)]
    pub fn destroy(
        &mut self,
        commands: &mut Commands,
        buf: &mut BufferStore,
        batch_table: &mut BatchTable,
        features: &Query<&FeatureId>,
        batch_id: &Query<&BatchId>,
        batched_features: &Query<&BatchedFeature>,
        renderable_features: &mut Query<&mut RenderableFeature>,
    ) -> Vec<Entity> {
        let mut removed_features = vec![];
        if let Some(feature_ids) = self.feature_ids.take() {
            for feature_id in feature_ids {
                if let Ok(batched_feature) = batched_features.get(feature_id) {
                    let mut removed = batched_feature.despawn_recursively(
                        commands,
                        buf,
                        batch_table,
                        features,
                        batch_id,
                        renderable_features,
                    );
                    removed_features.append(&mut removed);
                }
                if let Some(feature_id) = features.get(feature_id).ok().and_then(|f| f.0) {
                    if let Ok(mut feature) = renderable_features.get_mut(feature_id) {
                        feature.destroy(buf);
                    }
                    commands.entity(feature_id).despawn();
                    removed_features.push(feature_id);
                }
                commands.entity(feature_id).despawn();
            }
        }
        removed_features
    }
}
