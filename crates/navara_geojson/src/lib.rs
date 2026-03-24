#![doc = include_str!("../README.md")]

use bevy_app::{App, Plugin, Update};
use bevy_ecs::schedule::IntoScheduleConfigs;
use navara_layer::{LayerDescStore, LayerStore};
use navara_vector_tile::VectorTileSet;

mod geometry;
mod system;
mod tile;

pub struct GeoJsonPlugin;

impl Plugin for GeoJsonPlugin {
    fn build(&self, app: &mut App) {
        // TODO: Carve out those layer management structs into `navara_layer_event` plugin.
        app.insert_resource(LayerStore::new());
        app.insert_resource(LayerDescStore::new());
        app.add_systems(
            Update,
            (
                system::request_geojson,
                system::parse_geojson,
                system::construct_feature,
                tile::setup_tiled_geojson,
                system::update_geo_json_layer,
                system::delete_geo_json_layer,
            )
                .chain()
                .in_set(VectorTileSet::Prepare),
        );
    }
}
