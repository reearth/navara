use bevy_ecs::{
    entity::Entity,
    query::Added,
    removal_detection::RemovedComponents,
    system::{Query, ResMut},
};

use crate::event::EventStore;

use super::render::RenderableFeature;

// FIXME: Add updated event
pub fn commit(
    mut events: ResMut<EventStore>,
    added: Query<Entity, Added<RenderableFeature>>,
    mut removed: RemovedComponents<RenderableFeature>,
) {
    for e in &added {
        events.renderable_feature_added.push(e);
    }
    for e in removed.read() {
        // FIEME: Removed event
        events.renderable_feature_removed.push(e);
    }
}
