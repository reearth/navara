#![doc = include_str!("../README.md")]

use bevy_app::{App, Plugin, Update};
use navara_layer::{LayerDescStore, LayerStore};
use std::collections::HashMap;

mod system;

pub struct GeoJsonPlugin;

impl Plugin for GeoJsonPlugin {
    fn build(&self, app: &mut App) {
        app.insert_resource(LayerStore {
            map: HashMap::new(),
        });
        app.insert_resource(LayerDescStore {
            map: HashMap::new(),
        });
        app.add_systems(Update, system::construct_feature);
    }
}
