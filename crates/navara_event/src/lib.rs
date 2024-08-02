#![doc = include_str!("../README.md")]

mod events;

use bevy_app::PreUpdate;
use bevy_ecs::system::ResMut;

pub use events::*;
pub use navara_event_store::EventStore;

pub struct EventPlugin;

impl bevy_app::Plugin for EventPlugin {
    fn build(&self, app: &mut bevy_app::App) {
        app.insert_resource(EventStore::default())
            .add_systems(PreUpdate, init_events);
    }
}

pub fn init_events(mut events: ResMut<EventStore>) {
    events.clear();
}
