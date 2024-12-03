#![doc = include_str!("../README.md")]

use bevy_app::{App, Plugin, Update};
use bevy_ecs::schedule::IntoSystemConfigs;

mod data_requester;
mod geometry;
mod layer;
mod pos_converter;

pub struct MvtPlugin;

impl Plugin for MvtPlugin {
    fn build(&self, app: &mut App) {
        app.add_systems(
            Update,
            (
                data_requester::system::request_single_mvt,
                layer::system::construct_single_mvt,
                layer::system::update_mvt_layer,
                layer::system::delete_mvt_layer,
            )
                .chain(),
        );
    }
}
