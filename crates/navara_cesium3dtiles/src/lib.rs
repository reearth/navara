#![doc = include_str!("../README.md")]
//!
//! # System Ordering
//!
//! The plugin registers systems in a specific order to ensure correct data flow.
//! Systems are chained within each group to run sequentially.
//!
//! ## Standalone Layer Systems
//!
//! For B3DM and PNTS files loaded directly (not via 3D Tiles):
//! - `request_model_by_*_layer` → `construct_model_by_*_layer` →
//!   `delete_model_by_*_layer` → `update_model_by_*_layer`
//!
//! ## 3D Tiles System Chain
//!
//! The main 3D Tiles processing pipeline:
//!
//! 1. **request_metadata** - Spawn data requesters for new tilesets
//! 2. **construct_cesium_3d_tiles_tree** - Parse tileset.json into tree structure
//! 3. **traverse_cesium_3d_tiles_tree** - Select visible tiles based on SSE
//! 4. **filter_requestable_data_requester** - Prioritize pending data requests
//! 5. **construct_model_by_cesium3dtiles_layer** (B3DM/PNTS/GLB) - Create models
//! 6. **remove_invisible_rendered_tiles** (B3DM/PNTS/GLB) - Clean up invisible tiles
//! 7. **remove_invisible_tileset** - Clean up nested tilesets
//! 8. **delete_cesium3dtiles_layer** - Handle layer deletion
//! 9. **update_cesium3dtiles_layer** - Handle material updates
//!
//! ## Integration with navara_feature
//!
//! After model construction, `navara_feature::model::system::transfer_mesh` runs
//! (in a different plugin) to convert `ModelGeometry` + `ModelBin` into
//! `RenderableFeature::Model`.
//!
//! When tiles are marked `Deleted`, `navara_feature::model::system::remove_batched_feature`
//! handles final cleanup of buffers and batch tables.

use bevy_app::{App, Plugin, Update};

mod b3dm;
mod cesium3dtiles;
mod glb;
mod pnts;

use bevy_ecs::schedule::IntoScheduleConfigs;
pub use cesium3dtiles::*;

/// Plugin that adds Cesium 3D Tiles support to the Navara engine.
///
/// Registers all systems needed for loading, traversing, rendering, and
/// cleaning up 3D Tiles datasets.
///
/// # Usage
///
/// ```ignore
/// app.add_plugins(Cesium3dTilesPlugin);
/// ```
pub struct Cesium3dTilesPlugin;

impl Plugin for Cesium3dTilesPlugin {
    fn build(&self, app: &mut App) {
        app.init_resource::<Cesium3dTilesJsonTileSetStateMap>();
        // Standalone B3DM layer systems (not part of 3D Tiles)
        app.add_systems(
            Update,
            (
                b3dm::system::request_model_by_b3dm_layer,
                b3dm::system::construct_model_by_b3dm_layer,
                b3dm::system::delete_model_by_b3dm_layer,
                b3dm::system::update_model_by_b3dm_layer,
            )
                .chain(),
        )
        // Standalone PNTS layer systems (not part of 3D Tiles)
        .add_systems(
            Update,
            (
                pnts::system::request_model_by_pnts_layer,
                pnts::system::construct_model_by_pnts_layer,
                pnts::system::delete_model_by_pnts_layer,
                pnts::system::update_model_by_pnts_layer,
            )
                .chain(),
        )
        // Main 3D Tiles processing pipeline
        .add_systems(
            Update,
            (
                // Phase 1: Tree construction
                cesium3dtiles::system::request_metadata,
                cesium3dtiles::system::construct_cesium_3d_tiles_tree,
                // Phase 2: Tile selection
                cesium3dtiles::system::traverse_cesium_3d_tiles_tree,
                cesium3dtiles::data_requester::systems::filter_requestable_data_requester,
                // Phase 3: Model construction (format-specific)
                b3dm::system::construct_model_by_cesium3dtiles_layer,
                pnts::system::construct_model_by_cesium3dtiles_layer,
                glb::system::construct_model_by_cesium3dtiles_layer,
                // Phase 4: Cleanup
                b3dm::system::remove_invisible_rendered_tiles,
                pnts::system::remove_invisible_rendered_tiles,
                glb::system::remove_invisible_rendered_tiles,
                cesium3dtiles::system::remove_invisible_tileset,
                // Phase 5: Layer management
                cesium3dtiles::system::delete_cesium3dtiles_layer,
                cesium3dtiles::system::update_cesium3dtiles_layer,
            )
                .chain(),
        );
    }
}
