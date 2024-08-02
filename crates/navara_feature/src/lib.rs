#![doc = include_str!("../README.md")]

use bevy_app::{App, Plugin, PostUpdate};

pub mod billboard;
pub mod event;
pub mod point;
pub mod render;

pub struct FeaturePlugin;

impl Plugin for FeaturePlugin {
    fn build(&self, app: &mut App) {
        app.add_systems(PostUpdate, event::commit);
    }
}
