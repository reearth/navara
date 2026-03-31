#![doc = include_str!("../README.md")]

use bevy_app::{App, Plugin, PostUpdate, PreUpdate, Update};
use bevy_ecs::schedule::IntoScheduleConfigs;
use navara_feature_component::batch::{BatchTable, FeatureBatchIdMap};
use navara_geometry::PolygonResource;

mod billboard;
mod event;
mod geometry;
mod model;
mod point;
mod polygon;
mod polyline;
mod text;

pub struct FeaturePlugin;

impl Plugin for FeaturePlugin {
    fn build(&self, app: &mut App) {
        app.init_resource::<PolygonResource>()
            .init_resource::<BatchTable>()
            .init_resource::<FeatureBatchIdMap>()
            // Despawn RenderableFeature after removed event is sent.
            // Otherwise removed event can't reach to client.
            .add_systems(PreUpdate, event::despawn)
            .add_systems(
                Update,
                (
                    point::system::transfer_batched_mesh,
                    point::system::update_height_by_terrain_for_batched,
                    point::system::remove_batched_feature,
                )
                    .chain(),
            )
            .add_systems(
                Update,
                (
                    billboard::system::transfer_batched_mesh,
                    billboard::system::update_height_by_terrain_for_batched,
                    billboard::system::remove_batched_feature,
                )
                    .chain(),
            )
            .add_systems(
                Update,
                (
                    text::system::transfer_batched_mesh,
                    text::system::update_height_by_terrain_for_batched,
                    text::system::remove_batched_feature,
                )
                    .chain(),
            )
            .add_systems(
                Update,
                (
                    model::system::transfer_mesh,
                    model::system::remove_batched_feature,
                )
                    .chain(),
            )
            .add_systems(
                Update,
                (
                    polyline::system::transfer_batched_mesh,
                    polyline::system::update_height_by_terrain,
                    polyline::system::remove_batched_feature,
                )
                    .chain(),
            )
            .add_systems(
                Update,
                (
                    polygon::system::transfer_batched_mesh,
                    polygon::system::update_polygon,
                    polygon::system::remove_batched_feature,
                )
                    .chain(),
            )
            .add_systems(PostUpdate, event::commit);
    }
}
