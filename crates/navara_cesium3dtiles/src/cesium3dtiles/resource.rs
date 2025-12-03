use bevy_ecs::{entity::Entity, resource::Resource};
use navara_parser::cesium3dtiles::tileset::Tile;
use std::collections::{hash_map, HashMap};

#[derive(Debug, Hash, PartialEq, Eq)]
pub struct Cesium3dTilesJsonTileSetStateMapKey {
    layer_id: Entity,
    path: String,
}

impl Cesium3dTilesJsonTileSetStateMapKey {
    pub fn from_tile(layer_id: Entity, tile_meta: &Tile) -> Option<Self> {
        let uri = tile_meta.content.as_ref().map(|c| c.uri.clone())?;
        let path = Self::get_path(&uri)?;
        Some(Self { layer_id, path })
    }
    pub fn from_url(layer_id: Entity, url: &str) -> Option<Self> {
        let path = Self::get_path(url)?;
        Some(Self { layer_id, path })
    }

    fn get_path(url: &str) -> Option<String> {
        Some(url.split('?').next()?.split('/').next_back()?.to_string())
    }
}

#[derive(Default, Debug)]
pub struct Cesium3dTilesJsonTileSetState {
    pub is_constucted: bool,
}

#[derive(Default, Debug)]
pub struct Cesium3dTileSetState {
    pub has_rendered_tiles: bool,
}

#[derive(Default, Debug, Resource)]
pub struct Cesium3dTilesJsonTileSetStateMap {
    json_node_to_tileset_state_map:
        HashMap<Cesium3dTilesJsonTileSetStateMapKey, Cesium3dTilesJsonTileSetState>,
    tileset_state_map: HashMap<Cesium3dTilesJsonTileSetStateMapKey, Cesium3dTileSetState>,
}

impl Cesium3dTilesJsonTileSetStateMap {
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

    pub fn set_json_node_to_tileset_state(
        &mut self,
        key: Cesium3dTilesJsonTileSetStateMapKey,
        state: Cesium3dTilesJsonTileSetState,
    ) {
        self.json_node_to_tileset_state_map.insert(key, state);
    }
    pub fn get_json_node_to_tileset_state(
        &self,
        key: &Cesium3dTilesJsonTileSetStateMapKey,
    ) -> Option<&Cesium3dTilesJsonTileSetState> {
        self.json_node_to_tileset_state_map.get(key)
    }
}
