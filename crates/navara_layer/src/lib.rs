#![doc = include_str!("../README.md")]

mod appearance;
mod descriptor;
mod event;
mod geojson;
mod terrain;
mod tile;
mod layer_id;
mod layer_store;

pub use appearance::*;
use bevy_app::{App, Plugin, Update};
pub use descriptor::*;
pub use event::AddLayerEvent;
pub use geojson::*;
pub use terrain::*;
pub use tile::*;
pub use layer_id::*;
pub use layer_store::*;

pub struct LayerPlugin;

impl Plugin for LayerPlugin {
    fn build(&self, app: &mut App) {
        app.add_event::<AddLayerEvent>()
            .add_systems(Update, event::process_add_events);
    }
}
