#![doc = include_str!("../README.md")]

use bevy_app::{App, Plugin, PostUpdate, Update};
use bevy_ecs::schedule::IntoSystemConfigs;
use navara_feature_component::batch::{BatchTable, FeatureBatchIdMap, IdPropertyTable};
use navara_geometry::PolygonResource;

mod billboard;
mod event;
mod model;
mod point;
mod polygon;
mod polyline;

pub struct FeaturePlugin;

impl Plugin for FeaturePlugin {
    fn build(&self, app: &mut App) {
        app.init_resource::<PolygonResource>()
            .init_resource::<BatchTable>()
            .init_resource::<FeatureBatchIdMap>()
            .init_resource::<IdPropertyTable>()
            .add_systems(
                Update,
                (
                    point::system::transfer_mesh,
                    point::system::update_height_by_terrain,
                )
                    .chain(),
            )
            .add_systems(
                Update,
                (
                    billboard::system::transfer_mesh,
                    billboard::system::update_height_by_terrain,
                )
                    .chain(),
            )
            .add_systems(
                Update,
                (
                    model::system::transfer_mesh,
                    model::system::update_height_by_terrain,
                )
                    .chain(),
            )
            .add_systems(
                Update,
                (
                    polyline::system::transfer_mesh,
                    polyline::system::transfer_batched_mesh,
                    polyline::system::update_height_by_terrain,
                )
                    .chain(),
            )
            .add_systems(
                Update,
                (
                    polygon::system::transfer_mesh,
                    polygon::system::transfer_batched_mesh,
                    polygon::system::update_polygon,
                    polygon::system::update_height_by_terrain,
                )
                    .chain(),
            )
            .add_systems(PostUpdate, event::commit);
    }
}
