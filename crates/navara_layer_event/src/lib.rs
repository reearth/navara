#![doc = include_str!("../README.md")]

mod event;

use bevy_app::{App, Plugin, Update};
pub use event::{AddLayerEvent, DeleteLayerEvent, UpdateLayerEvent};

pub struct LayerPlugin;

impl Plugin for LayerPlugin {
    fn build(&self, app: &mut App) {
        app.add_event::<AddLayerEvent>()
            .add_systems(Update, event::process_add_events);

        app.add_event::<UpdateLayerEvent>()
            .add_systems(Update, event::process_update_events);

        app.add_event::<DeleteLayerEvent>()
            .add_systems(Update, event::process_delete_events);
    }
}
