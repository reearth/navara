#![doc = include_str!("../README.md")]

use bevy_app::{App, Plugin, PostUpdate, PreUpdate, Update};
use bevy_ecs::schedule::IntoScheduleConfigs;
use bevy_ecs::system::{Res, ResMut};
use navara_feature_component::batch::{BatchTable, FeatureBatchIdMap};
use navara_geometry::PolygonResource;
use navara_memory::{MemoryAccountingSet, MemoryLedger};
use navara_tile::TileSet;

/// Publishes the `BatchTable`'s attribute-table bytes (invisible to
/// `BufferStore`) into the memory ledger, so the budget, eviction, and
/// SSE-pressure degrade see them.
fn sync_batch_table_bytes(batch_table: Res<BatchTable>, mut ledger: ResMut<MemoryLedger>) {
    ledger.external_cpu_bytes = batch_table.total_bytes() as u64;
}

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
            // Feed attribute-table bytes into the memory ledger before its
            // pressure/stat systems run.
            .add_systems(
                PostUpdate,
                sync_batch_table_bytes.in_set(MemoryAccountingSet),
            )
            // Despawn RenderableFeature after removed event is sent.
            // Otherwise removed event can't reach to client.
            .add_systems(PreUpdate, event::despawn)
            .add_systems(
                Update,
                (
                    point::system::transfer_batched_mesh,
                    point::system::update_height_by_terrain_for_batched.after(TileSet),
                    point::system::remove_batched_feature,
                )
                    .chain(),
            )
            .add_systems(
                Update,
                (
                    billboard::system::transfer_batched_mesh,
                    billboard::system::update_height_by_terrain_for_batched.after(TileSet),
                    billboard::system::remove_batched_feature,
                )
                    .chain(),
            )
            .add_systems(
                Update,
                (
                    text::system::transfer_batched_mesh,
                    text::system::update_height_by_terrain_for_batched.after(TileSet),
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
                    polyline::system::update_height_by_terrain.after(TileSet),
                    polyline::system::remove_batched_feature,
                )
                    .chain(),
            )
            .add_systems(
                Update,
                (
                    polygon::system::transfer_batched_mesh,
                    polygon::system::update_polygon,
                    polygon::system::update_height_by_terrain.after(TileSet),
                    polygon::system::remove_batched_feature,
                )
                    .chain(),
            )
            .add_systems(PostUpdate, event::commit);
    }
}
