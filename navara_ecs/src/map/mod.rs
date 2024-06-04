use bevy_app::{App, Plugin, PostUpdate, Update};

mod event;
pub use event::AddLayerEvent;
use event::*;
mod layer;
pub use layer::LayerDescription;
mod tile;
use tile::{tile_cache_manager::TileCacheManager, TileQuadtree};

pub struct MapPlugin;

impl Plugin for MapPlugin {
    fn build(&self, app: &mut App) {
        app.init_resource::<TileCacheManager>()
            .insert_resource(TileQuadtree::new_with_region_qt(30))
            .add_systems(
                Update,
                (
                    set_data_requester_loaded,
                    process_add_events,
                    tile::system::update_tiles,
                    tile::system::transfer_mesh,
                    tile::system::load_tiles,
                    send_data_requst_events,
                ),
            )
            .add_systems(PostUpdate, tile::system::end_update)
            .add_event::<AddLayerEvent>();
    }
}
