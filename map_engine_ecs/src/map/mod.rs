use bevy_app::{App, Plugin, Update};

mod event;
pub use event::AddLayerEvent;
use event::*;
mod layer;
pub use layer::LayerDescription;
mod tile;
use tile::*;

pub struct MapPlugin;

impl Plugin for MapPlugin {
    fn build(&self, app: &mut App) {
        app.add_systems(
            Update,
            (
                set_data_requester_loaded,
                process_add_events,
                update_tiles,
                load_tiles,
                send_data_requst_events,
            ),
        )
        .add_event::<AddLayerEvent>();
    }
}
