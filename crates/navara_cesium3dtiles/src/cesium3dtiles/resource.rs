use bevy_ecs::{entity::Entity, resource::Resource};
use std::collections::{hash_map, HashMap};

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

#[derive(Default, Debug)]
pub struct Cesium3dTileSetState {
    pub has_rendered_tiles: bool,
    pub renderable: bool,
    /// When true, the child tree should be removed because the parent tile is no longer needed.
    pub should_remove: bool,
}

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
