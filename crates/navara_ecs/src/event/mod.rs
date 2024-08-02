mod model;
mod res;

use bevy_app::PreUpdate;
use bevy_ecs::system::ResMut;

pub use self::res::EventStore;
pub use model::*;

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
