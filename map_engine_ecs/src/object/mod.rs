use bevy_app::PostUpdate;
use bevy_ecs::{
    bundle::Bundle,
    component::Component,
    entity::Entity,
    query::Changed,
    removal_detection::RemovedComponents,
    system::{Query, ResMut},
};

use crate::{event::EventStore, Transform};

#[derive(Component, Debug)]
pub struct ObjectMarker;

#[derive(Bundle, Debug)]
pub struct ObjectBundle {
    pub transform: Transform,
    pub marker: ObjectMarker,
}

pub struct ObjectPlugin;

impl bevy_app::Plugin for ObjectPlugin {
    fn build(&self, app: &mut bevy_app::App) {
        app.add_systems(PostUpdate, commit_events);
    }
}

fn commit_events(
    mut events: ResMut<EventStore>,
    mut removed: RemovedComponents<ObjectMarker>,
    mut changed: Query<(Entity, &ObjectMarker), Changed<Transform>>,
) {
    for e in removed.read() {
        events.object_removed.push(e);
    }

    for (e, _) in changed.iter_mut() {
        events.object_transform_updated.push(e);
    }
}
