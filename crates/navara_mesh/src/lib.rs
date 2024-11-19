#![doc = include_str!("../README.md")]

use bevy_app::{PostUpdate, PreUpdate};
use bevy_ecs::{
    bundle::Bundle,
    component::Component,
    entity::Entity,
    query::{Added, Changed, With, Without},
    system::{Commands, Query, ResMut},
};

mod cache;
pub use cache::*;
use navara_buffer_store::Handle;
use navara_component::Deleted;
use navara_event_store::EventStore;
use navara_math::Transform;

#[derive(Component, Debug, Default)]
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
    pub active: bool,
    pub render_order: i32,
}

#[derive(Debug, Clone, Component, PartialEq)]
pub struct Material {
    pub color: u32,
    pub show: bool,
    pub wireframe: bool,
    pub should_compute_normal_from_vertex: bool,
    // for tile
    pub texture_fragment: Option<Entity>,
}

#[derive(Bundle, Debug)]
pub struct MeshBundle {
    pub mesh: Mesh,
    pub material: Material,
    pub object: ObjectBundle,
}

pub struct MeshPlugin;

impl bevy_app::Plugin for MeshPlugin {
    fn build(&self, app: &mut bevy_app::App) {
        app.add_systems(PreUpdate, remove_removed_mesh)
            .add_systems(PostUpdate, commit_events);
    }
}

#[allow(clippy::type_complexity)]
fn commit_events(
    mut events: ResMut<EventStore>,
    removed: Query<Entity, (With<Mesh>, With<Deleted>)>,
    t_changed: Query<Entity, (With<Mesh>, Changed<Transform>, Without<Deleted>)>,
    mesh_added: Query<Entity, (Added<Mesh>, Without<Deleted>)>,
    mesh_changed: Query<Entity, (Changed<Mesh>, Without<Deleted>)>,
    // mat_changed: Query<(Entity, &ObjectMarker, &Material), Changed<Material>>,
) {
    for e in t_changed.iter() {
        events.object_transform_updated.push(e);
    }

    for e in mesh_added.iter() {
        events.mesh_added.push(e);
    }

    for e in mesh_changed.iter() {
        events.mesh_updated.push(e);
    }

    // for (e, _, _) in mat_changed.iter() {
    //     events.mesh_updated.push(e);
    // }

    for e in &removed {
        events.mesh_removed.push(e);
    }
}

fn remove_removed_mesh(
    mut commands: Commands,
    removed: Query<Entity, (With<Mesh>, With<Deleted>)>,
) {
    for e in &removed {
        commands.entity(e).despawn();
    }
}
