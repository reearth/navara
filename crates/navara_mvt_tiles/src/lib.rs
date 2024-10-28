#![doc = include_str!("../README.md")]

use bevy_app::{App, Plugin};

mod mvt;

pub struct MvtTilesPlugin;

impl Plugin for MvtTilesPlugin {
    fn build(&self, app: &mut App) {
        app.add_plugins(mvt::MvtPlugin);
    }
}
