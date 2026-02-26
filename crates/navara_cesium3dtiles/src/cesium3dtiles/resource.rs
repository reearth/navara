//! Resources for Cesium 3D Tiles State Management
//!
//! This module contains ECS resources used to track state across the tile
//! system, particularly for coordinating between parent and child tilesets.

use bevy_ecs::{entity::Entity, resource::Resource};
use std::collections::{HashMap, hash_map};

/// Key for identifying a nested tileset's state.
///
/// Combines the layer ID and the parent tile's data requester ID to
/// uniquely identify a child tileset's relationship to its parent.
#[derive(Debug, Hash, PartialEq, Eq, Clone)]
pub struct Cesium3dTilesJsonTileSetStateMapKey {
    layer_id: Entity,
    data_requester_id: Entity,
}

impl Cesium3dTilesJsonTileSetStateMapKey {
    pub fn new(layer_id: Entity, data_requester_id: Entity) -> Self {
        Self {
            layer_id,
            data_requester_id,
        }
    }
}

/// State of a nested tileset as seen by its parent.
///
/// This enables parent tiles to know when their child tilesets are ready,
/// which is essential for REPLACE refinement to work correctly.
#[derive(Default, Debug)]
pub struct Cesium3dTileSetState {
    /// True when the child tileset has visible rendered tiles.
    pub has_rendered_tiles: bool,
    /// Reserved for future use.
    pub renderable: bool,
    /// When true, the child tree should be removed because the parent tile is no longer needed.
    pub should_remove: bool,
}

/// Global resource for tracking nested tileset state.
///
/// When a tile's content is a nested tileset.json (not a B3DM/PNTS/GLB),
/// the child tileset needs to communicate its state back to the parent.
/// This resource enables that communication across separate tile trees.
///
/// # Use Cases
///
/// 1. **Parent waiting for children**: In REPLACE refinement, a parent tile
///    stays visible until all children are loaded. For nested tilesets,
///    `has_rendered_tiles` indicates when the child is ready.
///
/// 2. **Cleanup coordination**: When a parent tile goes out of view,
///    `mark_for_removal` signals child trees to clean themselves up.
///
/// # Memory Considerations
///
/// Entries in this map should be cleaned up when:
/// - The nested tileset is removed via `remove_tileset_state`
/// - The parent layer is deleted
///
/// Failure to clean up entries would cause a memory leak.
#[derive(Default, Debug, Resource)]
pub struct Cesium3dTilesJsonTileSetStateMap {
    tileset_state_map: HashMap<Cesium3dTilesJsonTileSetStateMapKey, Cesium3dTileSetState>,
    needs_update: bool,
}

impl Cesium3dTilesJsonTileSetStateMap {
    pub fn set_has_rendered_tiles(&mut self, key: Cesium3dTilesJsonTileSetStateMapKey, v: bool) {
        self.entry_tileset_state(key)
            .and_modify(|s| {
                s.has_rendered_tiles = v;
                s.should_remove = false;
            })
            .or_insert(Cesium3dTileSetState {
                has_rendered_tiles: v,
                ..Default::default()
            });

        self.needs_update = true;
    }

    pub fn needs_update(&mut self) -> bool {
        self.needs_update
    }

    pub fn set_needs_update(&mut self, v: bool) {
        self.needs_update = v;
    }

    pub fn entry_tileset_state(
        &mut self,
        key: Cesium3dTilesJsonTileSetStateMapKey,
    ) -> hash_map::Entry<'_, Cesium3dTilesJsonTileSetStateMapKey, Cesium3dTileSetState> {
        self.tileset_state_map.entry(key)
    }

    pub fn get_tileset_state(
        &self,
        key: &Cesium3dTilesJsonTileSetStateMapKey,
    ) -> Option<&Cesium3dTileSetState> {
        self.tileset_state_map.get(key)
    }

    pub fn remove_tileset_state(
        &mut self,
        key: &Cesium3dTilesJsonTileSetStateMapKey,
    ) -> Option<Cesium3dTileSetState> {
        self.tileset_state_map.remove(key)
    }

    /// Mark a child tree for removal. Called by the parent tile when it's no longer needed.
    pub fn mark_for_removal(&mut self, key: Cesium3dTilesJsonTileSetStateMapKey) {
        self.entry_tileset_state(key)
            .and_modify(|s| s.should_remove = true)
            .or_insert(Cesium3dTileSetState {
                should_remove: true,
                ..Default::default()
            });
        self.needs_update = true;
    }

    /// Check if a child tree is marked for removal.
    pub fn is_marked_for_removal(&self, key: &Cesium3dTilesJsonTileSetStateMapKey) -> bool {
        self.tileset_state_map
            .get(key)
            .is_some_and(|s| s.should_remove)
    }
}
