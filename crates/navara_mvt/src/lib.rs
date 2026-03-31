#![doc = include_str!("../README.md")]

use bevy_app::{App, Plugin, Update};
use bevy_ecs::schedule::IntoScheduleConfigs;
use navara_vector_tile::VectorTileSet;

mod data_requester;
mod geometry;
mod layer;
pub mod source;
mod source_cache;

pub use navara_vector_tile::LayerResources as MvtLayerResources;
pub use source_cache::{
    MvtSourceCache, MvtSourceId, MvtSourceResources, SourceId, TraversalConfig,
};

pub struct MvtPlugin;

impl Plugin for MvtPlugin {
    fn build(&self, app: &mut App) {
        app.add_systems(
            Update,
            (
                layer::system::update_mvt_layer,
                layer::system::delete_mvt_layer,
            )
                .chain(),
        )
        .add_systems(
            Update,
            layer::system::prepare_layer_resource.in_set(VectorTileSet::Prepare),
        );
    }
}
