use bevy_app::{App, Plugin, PostUpdate, Update};

mod tile_cache_manager;

mod event;
pub use event::AddLayerEvent;
use event::*;
mod layer;
pub use layer::LayerDescription;
mod tile;
mod tile_bounding_region;
use tile::*;

use self::tile_cache_manager::TileCacheManager;

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
                    update_tiles,
                    transfer_mesh,
                    load_tiles,
                    send_data_requst_events,
                ),
            )
            .add_systems(PostUpdate, end_update)
            .add_event::<AddLayerEvent>();
    }
}
