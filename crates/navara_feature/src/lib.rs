#![doc = include_str!("../README.md")]

use bevy_app::{App, Plugin, PostUpdate, Update};

pub mod billboard;
pub mod event;
pub mod point;
pub mod render;

pub struct FeaturePlugin;

impl Plugin for FeaturePlugin {
    fn build(&self, app: &mut App) {
        app.add_systems(
            Update,
            (
                point::system::transfer_mesh,
                point::system::update_height_by_terrain,
            ),
        )
        .add_systems(
            Update,
            (
                billboard::system::transfer_mesh,
                billboard::system::update_height_by_terrain,
            ),
        )
        .add_systems(PostUpdate, event::commit);
    }
}
