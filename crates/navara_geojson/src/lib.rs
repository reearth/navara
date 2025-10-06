#![doc = include_str!("../README.md")]

use bevy_app::{App, Plugin, Update};
use bevy_ecs::schedule::IntoScheduleConfigs;
use navara_layer::{LayerDescStore, LayerStore};
use std::collections::HashMap;

mod system;

pub struct GeoJsonPlugin;

impl Plugin for GeoJsonPlugin {
    fn build(&self, app: &mut App) {
        app.insert_resource(LayerStore::new());
        app.insert_resource(LayerDescStore {
            map: HashMap::new(),
        });
        app.add_systems(
            Update,
            (
                system::parse_geojson,
                system::request_geojson,
                system::construct_feature,
                system::update_geo_json_layer,
                system::delete_geo_json_layer,
            )
                .chain(),
        );
    }
}
