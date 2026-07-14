#![doc = include_str!("../README.md")]

mod event;

use bevy_app::{App, Plugin, Update};
use bevy_ecs::schedule::{IntoScheduleConfigs, SystemSet};
pub use event::{
    AddLayerEvent, DeleteLayerEvent, LayerReloadQueue, LiveLayer, PendingReload, UpdateLayerEvent,
    UpdateTerrainLayerEvent,
};

/// All layer add/update/delete/reload event processing. Downstream pipelines
/// (e.g. the tile `TileSet`) must be ordered AFTER this set: layer entities
/// spawn here via deferred commands, and without an explicit ordering the
/// spawn can land mid-frame BETWEEN a pipeline's `Added<...>`-driven reset
/// system and its traversal. Concretely, `update_terrain` once traversed with
/// a freshly spawned `TerrainLayer` one frame before
/// `sync_terrain_layer_changes` observed `Added<TerrainLayer>`; the deferred
/// teardown then destroyed the traversal's in-flight DEM requesters, and the
/// re-created shared-fetch consumers waited forever on a fetch whose result
/// had no live receiver (terrain never rendered unless minZoom skipped the
/// low-zoom requests).
#[derive(SystemSet, Debug, Clone, PartialEq, Eq, Hash)]
pub struct LayerEventSet;

pub struct LayerPlugin;

impl Plugin for LayerPlugin {
    fn build(&self, app: &mut App) {
        app.add_message::<AddLayerEvent>()
            .add_systems(Update, event::process_add_events.in_set(LayerEventSet));

        app.add_message::<UpdateLayerEvent>()
            .add_systems(Update, event::process_update_events.in_set(LayerEventSet));

        app.add_message::<UpdateTerrainLayerEvent>().add_systems(
            Update,
            event::process_update_terrain_events.in_set(LayerEventSet),
        );

        app.add_message::<DeleteLayerEvent>()
            .add_systems(Update, event::process_delete_events.in_set(LayerEventSet));

        app.init_resource::<LayerReloadQueue>()
            .add_systems(Update, event::flush_layer_reloads.in_set(LayerEventSet));
    }
}
