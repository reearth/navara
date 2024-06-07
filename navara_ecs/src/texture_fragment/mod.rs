use bevy_app::PostUpdate;
use bevy_ecs::{
    component::Component,
    entity::Entity,
    event::{Event, EventReader},
    query::Added,
    removal_detection::RemovedComponents,
    system::{Query, ResMut},
};
use bevy_log::info;

use crate::event::EventStore;

#[derive(Debug, Clone, PartialEq, Default)]
pub enum TextureFragmentStatus {
    #[default]
    Pending,
    Sucess,
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
    pub(crate) fn new(url: String) -> Self {
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
            .add_systems(PostUpdate, commit)
            .add_systems(PostUpdate, handle_loaded_event);
    }
}

fn commit(
    mut events: ResMut<EventStore>,
    added: Query<Entity, Added<TextureFragment>>,
    mut removed: RemovedComponents<TextureFragment>,
) {
    for e in &added {
        events.texture_fragment_reqested.push(e);
    }
    for e in removed.read() {
        events.texture_fragment_removed.push(e);
    }
}

#[derive(Debug, Event)]
pub struct TextureFragmentLoadedEvent {
    pub id: Entity,
    pub status: TextureFragmentStatus,
}

fn handle_loaded_event(
    mut loaded_ev: EventReader<TextureFragmentLoadedEvent>,
    mut t: Query<&mut TextureFragment>,
) {
    for e in loaded_ev.read() {
        info!("Texture fragmet loaded event is received!");
        let _ = t.get_mut(e.id).map(|mut t| {
            t.status = e.status.clone();
            info!(
                "Texture fragmet's status is changed: {:?} {}",
                e.status, t.url
            );
        });
    }
}
