#![doc = include_str!("../README.md")]

use bevy_app::{App, Plugin};

mod b3dm;

pub struct Cesium3dTilesPlugin;

impl Plugin for Cesium3dTilesPlugin {
    fn build(&self, app: &mut App) {
        app.add_plugins(b3dm::B3dmPlugin);
    }
}
