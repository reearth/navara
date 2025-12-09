use bevy_ecs::{entity::Entity, resource::Resource};
use navara_parser::cesium3dtiles::tileset::Tile;
use std::collections::{hash_map, HashMap};

#[derive(Debug, Hash, PartialEq, Eq, Clone)]
pub struct Cesium3dTilesJsonTileSetStateMapKey {
    layer_id: Entity,
    path: String,
}

impl Cesium3dTilesJsonTileSetStateMapKey {
    pub fn from_tile(layer_id: Entity, tile_meta: &Tile) -> Option<Self> {
        let uri = tile_meta
            .content
            .as_ref()
            .map(|c| c.uri.as_ref().unwrap_or_else(|| c.url.as_ref().unwrap()))?;
        let path = Self::get_path(uri)?;
        Some(Self { layer_id, path })
    }
    pub fn from_path(layer_id: Entity, path: &str) -> Option<Self> {
        let path = Self::get_path(path)?;
        Some(Self { layer_id, path })
    }

    /// Normalize path
    fn get_path(path: &str) -> Option<String> {
        Some(path.split('?').next()?.to_string())
    }
}

#[derive(Default, Debug)]
pub struct Cesium3dTileSetState {
    pub has_rendered_tiles: bool,
    pub renderable: bool,
}

#[derive(Default, Debug, Resource)]
pub struct Cesium3dTilesJsonTileSetStateMap {
    tileset_state_map: HashMap<Cesium3dTilesJsonTileSetStateMapKey, Cesium3dTileSetState>,
    needs_update: bool,
}

impl Cesium3dTilesJsonTileSetStateMap {
    pub fn set_has_rendered_tiles(&mut self, key: Cesium3dTilesJsonTileSetStateMapKey, v: bool) {
        self.entry_tileset_state(key)
            .and_modify(|s| s.has_rendered_tiles = v)
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
}
