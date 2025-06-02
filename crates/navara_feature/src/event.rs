use bevy_ecs::{
    entity::Entity,
    query::{Added, Changed, With},
    system::{Commands, Query, ResMut},
};

use navara_component::Deleted;
use navara_event_store::EventStore;

use navara_feature_component::render::RenderableFeature;

pub fn commit(
    mut events: ResMut<EventStore>,
    added: Query<Entity, Added<RenderableFeature>>,
    changed: Query<Entity, Changed<RenderableFeature>>,
    removed: Query<Entity, (With<RenderableFeature>, With<Deleted>)>,
) {
    for e in &added {
        events.renderable_feature_added.push(e);
    }
    for e in &changed {
        events.renderable_feature_changed.push(e);
    }
    for e in &removed {
        events.renderable_feature_removed.push(e);
    }
}

pub fn despawn(
    mut commands: Commands,
    removed: Query<Entity, (With<RenderableFeature>, With<Deleted>)>,
) {
    for e in &removed {
        if let Ok(mut e) = commands.get_entity(e) {
            e.despawn();
        }
    }
}
