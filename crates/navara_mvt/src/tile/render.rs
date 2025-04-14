use bevy_ecs::{
    component::Component,
    entity::Entity,
    system::{Commands, Query},
};

use navara_component::Deleted;
use navara_feature_component::{batch::BatchedFeature, id::FeatureId};
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
        features: &Query<&FeatureId>,
        batched_features: &Query<&BatchedFeature>,
    ) -> Vec<Entity> {
        let mut removed_features = vec![];
        if let Some(feature_ids) = self.feature_ids.take() {
            for feature_id in feature_ids {
                let batched_feature = batched_features.get(feature_id).unwrap();
                batched_feature.despawn_recursively(commands);

                if let Some(feature_id) = features.get(feature_id).unwrap().0 {
                    commands.entity(feature_id).insert(Deleted);
                    removed_features.push(feature_id);
                }
                commands.entity(feature_id).insert(Deleted);
            }
        }
        removed_features
    }
}
