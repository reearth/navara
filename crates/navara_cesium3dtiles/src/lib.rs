#![doc = include_str!("../README.md")]

use bevy_app::{App, Plugin, Update};

mod b3dm;
mod cesium3dtiles;

use bevy_ecs::schedule::IntoSystemConfigs;
pub use cesium3dtiles::*;

pub struct Cesium3dTilesPlugin;

impl Plugin for Cesium3dTilesPlugin {
    fn build(&self, app: &mut App) {
        app.add_plugins(b3dm::B3dmPlugin);
        app.add_systems(
            Update,
            (
                cesium3dtiles::system::request_metadata,
                cesium3dtiles::system::construct_cesium_3d_tiles_tree,
                (
                    cesium3dtiles::system::traverse_cesium_3d_tiles_tree,
                    cesium3dtiles::data_requester::systems::filter_requestable_data_requester,
                )
                    .chain(),
            ),
        );
    }
}
