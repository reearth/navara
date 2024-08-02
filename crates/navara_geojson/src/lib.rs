#![doc = include_str!("../README.md")]

use bevy_app::{App, Plugin, Update};

mod system;

pub struct GeoJsonPlugin;

impl Plugin for GeoJsonPlugin {
    fn build(&self, app: &mut App) {
        app.add_systems(
            Update,
            (
                system::construct_feature,
                system::update_feature_by_tile_change,
            ),
        );
    }
}
