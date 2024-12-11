#![doc = include_str!("../README.md")]

use bevy_app::{App, Plugin, PostUpdate, Update};
use navara_geometry::PolygonResource;

pub mod batch;
pub mod billboard;
pub mod event;
pub mod id;
mod marker;
pub mod model;
pub mod point;
pub mod polygon;
pub mod polyline;
pub mod render;

pub use marker::*;

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
            .add_systems(
                Update,
                (
                    polyline::system::transfer_mesh,
                    polyline::system::transfer_batched_mesh,
                ),
            )
            .add_systems(
                Update,
                (
                    polygon::system::transfer_mesh,
                    polygon::system::transfer_batched_mesh,
                    polygon::system::update_polygon,
                    polygon::system::update_height_by_terrain,
                ),
            )
            .add_systems(PostUpdate, event::commit);
    }
}
