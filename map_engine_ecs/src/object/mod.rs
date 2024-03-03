use crate::{event::EventStore, Handle, Transform};
use bevy_app::PostUpdate;
use bevy_ecs::{
    bundle::Bundle,
    component::Component,
    entity::Entity,
    query::{Added, Changed},
    removal_detection::RemovedComponents,
    system::{Query, ResMut},
};

#[derive(Component, Debug)]
pub struct ObjectMarker;

#[derive(Bundle, Debug)]
pub struct ObjectBundle {
    pub transform: Transform,
    pub marker: ObjectMarker,
}

#[derive(Debug, Clone, Component, PartialEq)]
pub struct Mesh {
    pub vertices: Handle,
    pub uvs: Handle,
    pub indices: Handle,
}

#[derive(Debug, Clone, Component, PartialEq)]
pub struct Material {
    // for tile
    pub map_url: Option<String>,
}

#[derive(Bundle, Debug)]
pub struct MeshBundle {
    pub mesh: Mesh,
    pub material: Material,
    pub object: ObjectBundle,
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
    t_changed: Query<(Entity, &ObjectMarker), Changed<Transform>>,
    mesh_added: Query<(Entity, &ObjectMarker, &Mesh), Added<Mesh>>,
    mesh_changed: Query<(Entity, &ObjectMarker, &Mesh), Changed<Mesh>>,
    mat_changed: Query<(Entity, &ObjectMarker, &Material), Changed<Material>>,
) {
    for e in removed.read() {
        events.object_removed.push(e);
    }

    for (e, _) in t_changed.iter() {
        events.object_transform_updated.push(e);
    }

    for (e, _, _) in mesh_added.iter() {
        events.mesh_added.push(e);
    }

    for (e, _, _) in mesh_changed.iter() {
        if mesh_added.get(e).is_err() {
            events.mesh_updated.push(e);
        }
    }

    for (e, _, _) in mat_changed.iter() {
        if mesh_added.get(e).is_err() && mesh_changed.get(e).is_err() {
            events.mesh_updated.push(e);
        }
    }
}
