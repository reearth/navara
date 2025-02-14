use bevy_ecs::{
    component::Component,
    entity::Entity,
    system::{Commands, Query},
};
use navara_buffer_store::BufferStore;
use navara_feature_component::{
    batch::{BatchId, BatchTable, BatchedFeature, IdPropertyTable},
    id::FeatureId,
    render::RenderableFeature,
};
use navara_tile_component::VectorTileQuadtree;

use crate::tile::RenderedTile;

use super::tile_cache_manager::TileCacheManager;

#[derive(Component)]
pub struct LayerResources {
    pub quadtree: Entity,
    pub tile_cache_manager: Entity,
}

impl LayerResources {
    #[allow(clippy::too_many_arguments)]
    pub fn destroy(
        &self,
        commands: &mut Commands,
        buf: &mut BufferStore,
        batch_table: &mut BatchTable,
        id_prop_table_res: &mut IdPropertyTable,
        qts: &mut Query<&mut VectorTileQuadtree>,
        tc: &Query<&TileCacheManager>,
        features: &Query<&FeatureId>,
        batched_features: &Query<&BatchedFeature>,
        renderable_features: &mut Query<&mut RenderableFeature>,
        rendered_tiles: &mut Query<&mut RenderedTile>,
        batch_id: &Query<&BatchId>,
    ) {
        if let Ok(tc) = tc.get(self.tile_cache_manager) {
            let mut qt = qts.get_mut(self.quadtree);
            for e in tc.rendered_tile_caches.values() {
                if let Ok(mut r) = rendered_tiles.get_mut(*e) {
                    if let Ok(qt) = qt.as_mut() {
                        qt.qt.remove(r.tile_handle).unwrap().destroy(commands)
                    }
                    r.destroy(
                        commands,
                        buf,
                        batch_table,
                        id_prop_table_res,
                        features,
                        batch_id,
                        batched_features,
                        renderable_features,
                    );
                }
                commands.entity(*e).despawn();
            }
            for e in tc.requested_tile_caches.values() {
                commands.entity(*e).despawn();
            }
        }
        commands.entity(self.quadtree).despawn();
        commands.entity(self.tile_cache_manager).despawn();
    }
}
