use bevy_app::{App, Plugin, Update};

mod component;
mod requester;
mod system;

pub use component::*;
pub use requester::*;

pub struct B3dmPlugin;

impl Plugin for B3dmPlugin {
    fn build(&self, app: &mut App) {
        app.add_systems(
            Update,
            (
                system::remove_invisible_rendered_tiles,
                system::request_model_by_b3dm_layer,
                system::construct_model_by_b3dm_layer,
                system::construct_model_by_cesium3dtiles_layer,
            ),
        );
    }
}
