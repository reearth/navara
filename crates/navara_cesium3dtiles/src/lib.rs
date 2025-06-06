#![doc = include_str!("../README.md")]

use bevy_app::{App, Plugin, Update};

mod b3dm;
mod cesium3dtiles;
mod glb;

use bevy_ecs::schedule::IntoScheduleConfigs;
pub use cesium3dtiles::*;

pub struct Cesium3dTilesPlugin;

impl Plugin for Cesium3dTilesPlugin {
    fn build(&self, app: &mut App) {
        app.add_systems(
            Update,
            (
                b3dm::system::request_model_by_b3dm_layer,
                b3dm::system::construct_model_by_b3dm_layer,
                b3dm::system::delete_model_by_b3dm_layer,
                b3dm::system::update_model_by_b3dm_layer,
            )
                .chain(),
        )
        .add_systems(
            Update,
            (
                cesium3dtiles::system::request_metadata,
                cesium3dtiles::system::construct_cesium_3d_tiles_tree,
                cesium3dtiles::system::traverse_cesium_3d_tiles_tree,
                cesium3dtiles::data_requester::systems::filter_requestable_data_requester,
                b3dm::system::construct_model_by_cesium3dtiles_layer,
                glb::system::construct_model_by_cesium3dtiles_layer,
                b3dm::system::remove_invisible_rendered_tiles,
                cesium3dtiles::system::delete_cesium3dtiles_layer,
                cesium3dtiles::system::update_cesium3dtiles_layer,
            )
                .chain(),
        );
    }
}
