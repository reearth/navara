use std::collections::HashMap;

use bevy_ecs::{
    component::Component,
    entity::Entity,
    system::{Commands, Query},
};

use navara_component::Deleted;
use navara_feature_component::{batch::BatchedFeature, id::FeatureId};
use navara_layer::LayerId;
use navara_tile_component::TileHandle;

/// Removed features grouped by layer ID.
/// Used to properly update LayerStore for each layer when tiles are destroyed.
pub type RemovedFeaturesByLayer = HashMap<String, Vec<Entity>>;

#[derive(Component, Default)]
pub struct RenderedTile {
    pub(crate) tile_handle: TileHandle,
    pub(crate) feature_ids: Option<Vec<Entity>>,
}

impl RenderedTile {
    /// Destroys all features in this tile.
    /// Returns features grouped by layer ID so each layer's store can be updated.
    /// Used when the entire tile is being removed.
    #[allow(clippy::too_many_arguments)]
    pub fn destroy(
        &mut self,
        commands: &mut Commands,
        features: &Query<(&FeatureId, &LayerId)>,
        batched_features: &Query<&BatchedFeature>,
    ) -> RemovedFeaturesByLayer {
        let mut removed_by_layer: RemovedFeaturesByLayer = HashMap::new();
        if let Some(feature_ids) = self.feature_ids.take() {
            for feature_id in feature_ids {
                if let Ok(batched_feature) = batched_features.get(feature_id) {
                    batched_feature.despawn_recursively(commands);
                }

                // Track RenderableFeature for LayerStore removal, but DON'T mark as Deleted here.
                // The remove_batched_feature system will mark it as Deleted after calling
                // feature.destroy() to clean up BufferStore handles.
                if let Ok((fid, layer_id)) = features.get(feature_id) {
                    if let Some(fid_entity) = fid.0 {
                        removed_by_layer
                            .entry(layer_id.0.clone())
                            .or_default()
                            .push(fid_entity);
                    }
                }
                commands.entity(feature_id).insert(Deleted);
            }
        }
        removed_by_layer
    }

    /// Removes only features that belong to a specific layer.
    /// Used when a layer is deleted but other layers still share the same source.
    pub fn destroy_features_for_layer(
        &mut self,
        commands: &mut Commands,
        features: &Query<(&FeatureId, &LayerId)>,
        batched_features: &Query<&BatchedFeature>,
        target_layer_id: &LayerId,
    ) -> Vec<Entity> {
        let mut removed_features = Vec::new();

        let Some(feature_ids) = &mut self.feature_ids else {
            return removed_features;
        };

        let mut indices_to_remove = Vec::new();

        for (idx, &entity) in feature_ids.iter().enumerate() {
            if let Ok((feature_id, layer_id)) = features.get(entity) {
                if layer_id == target_layer_id {
                    indices_to_remove.push(idx);

                    // Despawn child entities
                    if let Ok(batched) = batched_features.get(entity) {
                        batched.despawn_recursively(commands);
                    }

                    // Track RenderableFeature for LayerStore removal
                    if let Some(fid) = feature_id.0 {
                        removed_features.push(fid);
                    }
                    commands.entity(entity).insert(Deleted);
                }
            }
        }

        // Remove from the list in reverse order to maintain indices
        for idx in indices_to_remove.into_iter().rev() {
            feature_ids.remove(idx);
        }

        removed_features
    }
}
