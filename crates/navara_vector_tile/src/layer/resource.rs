use bevy_ecs::{
    component::Component,
    entity::Entity,
    system::{Commands, Query, ResMut},
};
use navara_feature_component::{batch::BatchedFeature, id::FeatureId};
use navara_layer::LayerId;
use navara_tile_component::VectorTileQuadtree;

use crate::source_cache::{VectorTileSourceCache, VectorTileSourceResources};
use crate::tile::RenderedTile;

use super::tile_cache_manager::TileCacheManager;

/// Resources associated with a single vector tile layer.
#[derive(Component)]
pub struct LayerResources {
    pub layer_id: String,
    /// Reference to the shared [`VectorTileSourceResources`] entity.
    /// When multiple layers share the same URL, they reference the same source.
    pub source: Entity,

    /// Entity containing the `VectorTileQuadtree`.
    /// This may be shared across multiple layers with the same URL.
    pub quadtree: Entity,

    /// Entity containing the `TileCacheManager`.
    /// This may be shared across multiple layers with the same URL.
    pub tile_cache_manager: Entity,
}

impl LayerResources {
    /// Destroys this layer's resources.
    ///
    /// With shared sources, this method:
    /// 1. Removes features belonging to this specific layer from all rendered tiles
    /// 2. Removes this layer from the source's reference list
    /// 3. Only destroys the shared quadtree/cache if this was the last layer using them
    #[allow(clippy::too_many_arguments)]
    pub fn destroy(
        &self,
        layer_entity: Entity,
        layer_id: &LayerId,
        commands: &mut Commands,
        qts: &mut Query<&mut VectorTileQuadtree>,
        tc: &Query<&TileCacheManager>,
        features: &Query<(&FeatureId, &LayerId)>,
        batched_features: &Query<&BatchedFeature>,
        rendered_tiles: &mut Query<&mut RenderedTile>,
        sources: &mut Query<&mut VectorTileSourceResources>,
        source_cache: &mut ResMut<VectorTileSourceCache>,
    ) {
        // Remove this layer from the source's references
        let is_last_layer = if let Ok(mut source) = sources.get_mut(self.source) {
            source.remove_layer_ref(layer_entity)
        } else {
            // Source not found - treat as if we're the only layer
            true
        };

        // Source not found - treat as if we're the only layer from rendered tiles
        if let Ok(tc_ref) = tc.get(self.tile_cache_manager) {
            for rendered_tile_entity in tc_ref.rendered_tile_caches.values() {
                if let Ok(mut rendered_tile) = rendered_tiles.get_mut(*rendered_tile_entity) {
                    rendered_tile.destroy_features_for_layer(
                        commands,
                        features,
                        batched_features,
                        layer_id,
                    );
                }
            }
        }

        // Only clean up shared resources if this was the last layer using them
        if is_last_layer {
            if let Ok(tc_ref) = tc.get(self.tile_cache_manager) {
                let mut qt = qts.get_mut(self.quadtree);
                for e in tc_ref.rendered_tile_caches.values() {
                    if let Ok(mut r) = rendered_tiles.get_mut(*e) {
                        if let Ok(qt) = qt.as_mut()
                            && let Some(mut tile) = qt.qt.remove(r.tile_handle)
                        {
                            tile.destroy(commands);
                        }
                        r.destroy(commands, features, batched_features);
                    }
                    commands.entity(*e).despawn();
                }
                for e in tc_ref.requested_tile_caches.values() {
                    commands.entity(*e).despawn();
                }
            }
            commands.entity(self.quadtree).despawn();
            commands.entity(self.tile_cache_manager).despawn();
            commands.entity(self.source).despawn();

            // Remove from cache
            if let Ok(source) = sources.get(self.source) {
                source_cache.remove_source(&source.source_id);
            }
        }
    }
}
