#![doc = include_str!("../README.md")]

use bevy_app::{App, Plugin, Update};
use bevy_ecs::schedule::IntoSystemConfigs;

mod mvt;

pub struct MvtTilesPlugin;

impl Plugin for MvtTilesPlugin {
    fn build(&self, app: &mut App) {
        app.add_systems(
            Update,
            (
                mvt::system::request_mvt,
                mvt::system::construct_mvt,
                mvt::system::update_mvt_layer,
                mvt::system::delete_mvt_layer,
            )
                .chain(),
        );
    }
}
