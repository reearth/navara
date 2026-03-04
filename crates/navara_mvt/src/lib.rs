#![doc = include_str!("../README.md")]

use bevy_app::{App, Plugin, Update};
use bevy_ecs::schedule::IntoScheduleConfigs;

pub mod component;
mod data_requester;
mod geometry;
mod layer;
mod pos_converter;
mod source_cache;
mod tile;

pub use component::*;
pub use layer::*;
pub use source_cache::{MvtSourceCache, MvtSourceResources, SourceId};

pub struct MvtPlugin;

impl Plugin for MvtPlugin {
    fn build(&self, app: &mut App) {
        app.init_resource::<MvtSourceCache>()
            .add_systems(
                Update,
                (
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
