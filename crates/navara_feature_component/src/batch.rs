use bevy_ecs::{
    component::Component,
    entity::Entity,
    system::{Commands, Query},
};
use navara_buffer_store::BufferStore;

use crate::{id::FeatureId, render::RenderableFeature};

#[derive(Component, Debug, Default)]
pub struct BatchedFeature {
    pub features: Vec<Entity>,
    pub construct_polygon_feature: Option<Entity>,
    pub construct_polyline_feature: Option<Entity>,
}

impl BatchedFeature {
    pub fn despawn_recursively(
        &self,
        commands: &mut Commands,
        buf: &mut BufferStore,
        features: &Query<&FeatureId>,
        renderable_features: &mut Query<&mut RenderableFeature>,
    ) -> Vec<Entity> {
        let mut removed = vec![];
        for f in &self.features {
            if let Some(rendered_feature_id) = features.get(*f).ok().and_then(|f| f.0) {
                if let Ok(mut feature) = renderable_features.get_mut(rendered_feature_id) {
                    feature.destroy(buf);
                }
                commands.entity(rendered_feature_id).despawn();
                removed.push(rendered_feature_id);
            }
            if let Some(mut e) = commands.get_entity(*f) {
                e.despawn();
            }
        }
        removed
    }
}

#[derive(Component, Debug)]
pub struct BatchId(pub usize);
