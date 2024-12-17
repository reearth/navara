use bevy_ecs::{
    entity::Entity,
    query::{Added, Changed},
    removal_detection::RemovedComponents,
    system::{Query, ResMut},
};

use navara_event_store::EventStore;

use navara_feature_component::render::RenderableFeature;

pub fn commit(
    mut events: ResMut<EventStore>,
    added: Query<Entity, Added<RenderableFeature>>,
    changed: Query<Entity, Changed<RenderableFeature>>,
    mut removed: RemovedComponents<RenderableFeature>,
) {
    for e in &added {
        events.renderable_feature_added.push(e);
    }
    for e in &changed {
        events.renderable_feature_changed.push(e);
    }
    for e in removed.read() {
        events.renderable_feature_removed.push(e);
    }
}
