#![doc = include_str!("../README.md")]

use bevy_app::{App, Plugin, Update};
use bevy_ecs::schedule::IntoSystemConfigs;

mod component;
mod data_requester;
mod geometry;
mod layer;
mod pos_converter;
mod tile;

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
        )
        .add_systems(
            Update,
            (
                layer::system::prepare_layer_resource,
                tile::system::update_tiles,
                tile::system::transfer_mesh,
                data_requester::system::filter_requestable_data_requester,
                tile::system::clear_caches,
            )
                .chain(),
        );
    }
}
