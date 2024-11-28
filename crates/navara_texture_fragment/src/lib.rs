#![doc = include_str!("../README.md")]

use bevy_app::{PostUpdate, PreUpdate};
use bevy_ecs::{
    component::Component,
    entity::Entity,
    event::{Event, EventReader},
    query::{Added, With, Without},
    schedule::IntoSystemConfigs,
    system::{Commands, Query, ResMut},
};

use navara_component::{Deleted, Ignored, Requested};
use navara_event_store::EventStore;

#[derive(Debug, Clone, PartialEq, Default)]
pub enum TextureFragmentStatus {
    #[default]
    Pending,
    Success,
    Fail,
}

// This is used to track the texture that's handled outside of Wasm.
// Wasm doesn't have a way to I/O for now, so we must rely on outside of Wasm to handle I/O process.
// This struct helps to track the progress of loading the texture.
#[derive(Debug, Clone, Default, Component)]
pub struct TextureFragment {
    pub url: String,
    pub status: TextureFragmentStatus,
}

impl TextureFragment {
    pub fn new(url: String) -> Self {
        Self {
            url,
            ..Default::default()
        }
    }
}

pub struct TextureFragmentPlugin;

impl bevy_app::Plugin for TextureFragmentPlugin {
    fn build(&self, app: &mut bevy_app::App) {
        app.add_event::<TextureFragmentLoadedEvent>()
            .add_systems(PreUpdate, remove_removed_data_requesters)
            .add_systems(PostUpdate, (commit, handle_loaded_event).chain());
    }
}

#[allow(clippy::type_complexity)]
fn commit(
    mut commands: Commands,
    mut events: ResMut<EventStore>,
    added: Query<Entity, (Added<TextureFragment>, Without<Deleted>)>,
    removed: Query<Entity, (With<TextureFragment>, With<Deleted>, Without<Ignored>)>,
) {
    for e in &added {
        commands.entity(e).insert(Requested);
        events.texture_fragment_reqested.push(e);
    }
    for e in &removed {
        commands.entity(e).remove::<Requested>();
        events.texture_fragment_removed.push(e);
    }
}

#[derive(Debug, Event)]
pub struct TextureFragmentLoadedEvent {
    pub id: Entity,
    pub status: TextureFragmentStatus,
}

fn handle_loaded_event(
    mut commands: Commands,
    mut loaded_ev: EventReader<TextureFragmentLoadedEvent>,
    mut t: Query<&mut TextureFragment, Without<Deleted>>,
) {
    for e in loaded_ev.read() {
        let _ = t.get_mut(e.id).map(|mut t| {
            commands.entity(e.id).remove::<Requested>();
            t.status = e.status.clone();
        });
    }
}

fn remove_removed_data_requesters(
    mut commands: Commands,
    removed: Query<Entity, (With<TextureFragment>, With<Deleted>)>,
) {
    for e in &removed {
        commands.entity(e).remove::<Requested>();
        commands.entity(e).despawn();
    }
}
