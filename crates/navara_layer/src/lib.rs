#![doc = include_str!("../README.md")]

mod descriptor;
mod event;
mod geojson;
mod terrain;
mod tile;
mod layer_store;
mod layer_desc_store;
use bevy_app::{App, Plugin, Update};
pub use descriptor::*;
pub use event::AddLayerEvent;
// pub use event::UpdateLayerEvent;
pub use geojson::*;
pub use terrain::*;
pub use tile::*;
pub use layer_store::*;
pub use layer_desc_store::*;
pub struct LayerPlugin;

impl Plugin for LayerPlugin {
    fn build(&self, app: &mut App) {
        app.add_event::<AddLayerEvent>()
            .add_systems(Update, event::process_add_events);

        // app.add_event::<UpdateLayerEvent>()
        //     .add_systems(Update, event::process_update_events);
    }
}
