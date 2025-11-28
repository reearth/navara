use bevy_ecs::resource::Resource;
use std::collections::HashMap;

#[derive(Default, Debug, Resource)]
pub struct Cesium3dTilesJsonTileSet {
    pub json_node_to_tileset_state_map: HashMap<String, Cesium3dTilesJsonTileSetState>,
    pub tileset_state_map: HashMap<String, Cesium3dTileSetState>,
}

#[derive(Default, Debug)]
pub struct Cesium3dTilesJsonTileSetState {
    pub is_constucted: bool,
}

#[derive(Default, Debug)]
pub struct Cesium3dTileSetState {
    pub has_rendered_tiles: bool,
}