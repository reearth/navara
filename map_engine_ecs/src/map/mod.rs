use bevy_app::{App, Plugin, Update};

mod event;
pub use event::AddLayerEvent;
use event::*;
mod layer;
pub use layer::LayerDescription;
mod tile;
use map_engine_quadtree::Quadtree;
use tile::*;

pub struct MapPlugin;

impl Plugin for MapPlugin {
    fn build(&self, app: &mut App) {
        let mut qt = Quadtree::<u32, Tile>::new_with_region_qt(30);
        qt.qt
            .initialize_children((0, 0, 0), &|coords| Tile { coords });
        app.insert_resource(qt)
            .add_systems(
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
