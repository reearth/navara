#![doc = include_str!("../README.md")]

use bevy_app::{App, Plugin, PostUpdate, Update};
use navara_geometry::PolygonResource;

pub mod billboard;
pub mod event;
pub mod model;
pub mod point;
pub mod polygon;
pub mod polyline;
pub mod render;

pub struct FeaturePlugin;

impl Plugin for FeaturePlugin {
    fn build(&self, app: &mut App) {
        app.init_resource::<PolygonResource>()
            .add_systems(
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
            .add_systems(
                Update,
                (
                    model::system::transfer_mesh,
                    model::system::update_height_by_terrain,
                ),
            )
            .add_systems(Update, polyline::system::transfer_mesh)
            .add_systems(Update, polygon::system::transfer_mesh)
            .add_systems(PostUpdate, event::commit);
    }
}
