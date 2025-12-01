use core::sync;
use std::{any, collections::HashMap};

use bevy_ecs::{
    entity::Entity,
    system::{Commands, Query, ResMut},
};

use bevy_log::info;
use navara_buffer_store::BufferStore;
use navara_camera::CameraFrustum;
use navara_component::Priority;
use navara_data_requester::DataRequesterStatus;
use navara_feature_component::{id::FeatureId, render::RenderableFeature};
use navara_math::Vec3;
use navara_parser::cesium3dtiles::tileset::Refine;
use navara_window::Window;
use url::Url;

use crate::{
    b3dm::RenderedCesium3dTileContentB3dmMarker, glb::RenderedCesium3dTileContentGlbMarker,
    pnts::RenderedCesium3dTileContentPntsMarker, RenderedCesium3dTileContent,
    Cesium3dTilesJsonTileSet, Cesium3dTilesJsonTileSetState, Cesium3dTileSetState
};

use super::{
    request_tile_content, types::Cesium3dTileContentRequesterQuery, Cesium3dTileContent,
    Cesium3dTileContentMetadata, Cesium3dTilesMetadataDataRequesterMarker, TileOrderByDistance,
    TileTransform,
};

use navara_data_requester::{DataRequester, DataRequesterExtension};

#[derive(Debug, Clone, Copy)]
pub enum TraversalResult {
    Selected,
    ChildrenSelected,
    ChildrenSelectedPartially,
    // JsonChildFound,
    Culled,
}

#[allow(clippy::too_many_arguments)]
pub fn select_tiles(
    commands: &mut Commands,
    buf: &mut ResMut<BufferStore>,
    sync_json_tilesets: &mut ResMut<Cesium3dTilesJsonTileSet>,
    layer_id: Entity,
    max_sse: f32,
    base_url: &Url,
    tile_meta: &Cesium3dTileContentMetadata,
    tile: &mut Cesium3dTileContent,
    camera_position: Vec3,
    frustum: &CameraFrustum,
    requesters: &Cesium3dTileContentRequesterQuery,
    rendered_tiles: &mut Query<&mut RenderedCesium3dTileContent>,
    features: &Query<&FeatureId>,
    renderable_features: &Query<&RenderableFeature>,
    window: &Window,
) {
    if let TraversalResult::Selected = mark_leaves_2(
        commands,
        buf,
        sync_json_tilesets,
        base_url,
        layer_id,
        max_sse,
        tile_meta,
        tile,
        camera_position,
        frustum,
        requesters,
        window,
        rendered_tiles,
        features,
        renderable_features,
    ) {
        tile.state.leaf = true;
    };
    let mut rendered_tiles_count = 0;
    mark_rendered_tiles(
        commands,
        buf,
        sync_json_tilesets,
        layer_id,
        base_url,
        tile,
        requesters,
        rendered_tiles,
        &mut rendered_tiles_count,
    );
}

#[allow(clippy::too_many_arguments)]
fn mark_leaves(
    commands: &mut Commands,
    buf: &mut ResMut<BufferStore>,
    sync_json_tilesets: &mut ResMut<Cesium3dTilesJsonTileSet>,
    base_url: &Url,
    layer_id: Entity,
    max_sse: f32,
    tile_meta: &Cesium3dTileContentMetadata,
    tile: &mut Cesium3dTileContent,
    camera_position: Vec3,
    frustum: &CameraFrustum,
    requesters: &Cesium3dTileContentRequesterQuery,
    window: &Window,
    rendered_tiles: &mut Query<&mut RenderedCesium3dTileContent>,
    features: &Query<&FeatureId>,
    renderable_features: &Query<&RenderableFeature>,
) -> TraversalResult {
    tile.reset_state();

    let is_visible =
        !matches!(&tile.bounding_volume, Some(aabb) if !frustum.intersection_with_aabb(aabb));
    // if !is_visible {
    //     return TraversalResult::Culled;
    // }

    tile.state.is_visible = is_visible;

    let (distance_from_camera, sse) = match &tile.bounding_volume {
        Some(aabb) => {
            let distance_from_camera = aabb.distance_to_point(camera_position);
            let sse = (tile_meta.geometric_error)
                / (distance_from_camera * (frustum.sse_denominator / window.height)) as f64;
            (distance_from_camera, sse as f32)
        }
        None => (0., 0.),
    };
    tile.state.distance_from_camera = distance_from_camera;
    tile.state.sse = sse;

    let mut is_data_ready: bool;
    
    if tile.is_renderable_content {
        let data_requester = match tile.data_requester_id {
            Some(id) => requesters.get(id).ok().map(
                |d: (
                    &super::Cesium3dTileContentDataRequesterMarker,
                    &navara_data_requester::DataRequester,
                )| d.1,
            ),
            None => None,
        };
        is_data_ready = data_requester.is_some_and(|d| matches!(d.status, DataRequesterStatus::Success));
    } else {
        let uri = tile_meta.content.as_ref().map_or("".to_string(), |c| c.uri.clone()).split('?').next().unwrap_or("").to_string().split('/').last().unwrap_or("").to_string();
        is_data_ready = sync_json_tilesets
            .json_node_to_tileset_state_map
            .get(&uri)
            .is_some_and(|state| state.is_constucted == true);

        // info!("sync json tilesets: {:?}", sync_json_tilesets.json_node_to_tileset_state_map);
        // info!("sync json size: {}", sync_json_tilesets.json_node_to_tileset_state_map.len());

        is_data_ready = is_data_ready || uri.is_empty();
        // info!("non renderable content: checking if {} loaded: {}", uri, is_data_ready);
    }

    tile.state.is_data_loaded = is_data_ready;

    tile.state.touched = true;

    if !is_visible {
        return TraversalResult::Culled;
    }
    let meets_sse = sse < max_sse;
    if meets_sse {
        return TraversalResult::Selected;
    }

    // TODO: Support children from URL.
    if let Some(tile_meta_children) = &tile_meta.children {
        if tile.children.is_none() {
            tile.children = Some(Vec::with_capacity(tile_meta_children.len()));
        }
        let mut all_children_rendered = true;
        let mut all_children_loaded = true;
        let mut any_children_rendered = false;
        let mut selected_children = vec![];
        for (i, child_tile_meta) in tile_meta_children.iter().enumerate() {
            match tile.children.as_ref().unwrap().get(i) {
                Some(_) => {}
                None => {
                    let c = Cesium3dTileContent::new(child_tile_meta, Some(tile));
                    let tile_children = tile.children.as_mut().unwrap();
                    tile_children.push(c);
                }
            };

            let tile_children = tile.children.as_mut().unwrap();
            let child_tile = tile_children.get_mut(i).unwrap();

            let mut child_is_culled = false;
            // TODO: check the logic again here
            match mark_leaves(
                commands,
                buf,
                sync_json_tilesets,
                base_url,
                layer_id,
                max_sse,
                child_tile_meta,
                child_tile,
                camera_position,
                frustum,
                requesters,
                window,
                rendered_tiles,
                features,
                renderable_features,
            ) {
                TraversalResult::Selected => {
                    selected_children.push(i);
                    any_children_rendered = true;
                }
                TraversalResult::ChildrenSelected => {
                    any_children_rendered = true;
                }
                // Cull this tile partially
                TraversalResult::Culled => {
                    child_is_culled = true;
                    // all_children_rendered = false;
                }
                TraversalResult::ChildrenSelectedPartially => {
                    any_children_rendered = true;
                    all_children_rendered = false;
                }
            };

            all_children_loaded = all_children_loaded
                && (child_tile.state.are_all_children_loaded || child_tile.state.is_data_loaded || child_is_culled);
            if child_tile.is_renderable_content && !child_is_culled {
                all_children_rendered = all_children_rendered
                && child_tile.is_rendered(rendered_tiles, features, renderable_features);
            }
        }
        tile.state.are_all_children_loaded = all_children_loaded;
        if any_children_rendered {
            for (i, child) in tile.children.as_mut().unwrap().iter_mut().enumerate() {
                let is_selected_child = selected_children.contains(&i);

                if all_children_rendered && is_selected_child {
                    child.state.leaf = true;
                    continue;
                }

                if matches!(child.refine, Refine::Add) && is_selected_child {
                    child.state.leaf = true;
                }
            }

            if all_children_rendered {
                return TraversalResult::ChildrenSelected;
            }

            if matches!(tile.refine, Refine::Add) {
                return TraversalResult::ChildrenSelectedPartially;
            }
        }
    }

    // Handle JSON child tiles
    if let Some(content) = &tile_meta.content {
        if content.uri.contains(".json") {
            if tile_meta.children.is_none() && tile.data_requester_id.is_none() {
                // spawn a data requester to load the child tileset json.
                let url = construct_child_tile_url(base_url, content.uri.as_str())
                    .as_str()
                    .to_string();

                let e = commands
                    .spawn((
                        Cesium3dTilesMetadataDataRequesterMarker(layer_id),
                        Priority::Medium,
                        DataRequester::from_store(url, buf, DataRequesterExtension::Json),
                    ))
                    .id();
                tile.data_requester_id = Some(e);
                // TODO: trigger an event to indicate a child tileset json is requested, and some how be able to tie the json node to it's new tileset tree.
                let uri = content.uri.clone().split('?').next().unwrap_or("").to_string().split('/').last().unwrap_or("").to_string();
                // info!("Requesting child tileset json with uri: {}", uri);
                sync_json_tilesets
                    .json_node_to_tileset_state_map
                    .insert(uri, Cesium3dTilesJsonTileSetState::default());
            }
            // return TraversalResult::Selected;
        }
    }

    // Use this tile if children aren't found.
    TraversalResult::Selected
}



#[allow(clippy::too_many_arguments)]
fn mark_leaves_2(
    commands: &mut Commands,
    buf: &mut ResMut<BufferStore>,
    sync_json_tilesets: &mut ResMut<Cesium3dTilesJsonTileSet>,
    base_url: &Url,
    layer_id: Entity,
    max_sse: f32,
    tile_meta: &Cesium3dTileContentMetadata,
    tile: &mut Cesium3dTileContent,
    camera_position: Vec3,
    frustum: &CameraFrustum,
    requesters: &Cesium3dTileContentRequesterQuery,
    window: &Window,
    rendered_tiles: &mut Query<&mut RenderedCesium3dTileContent>,
    features: &Query<&FeatureId>,
    renderable_features: &Query<&RenderableFeature>,
) -> TraversalResult {
    
    tile.reset_state();

    let is_visible = matches!(&tile.bounding_volume, Some(aabb) if frustum.intersection_with_aabb(aabb));
    
    tile.state.is_visible = is_visible;
    
    let (distance_from_camera, sse) = match &tile.bounding_volume {
        Some(aabb) => {
            let distance_from_camera = aabb.distance_to_point(camera_position);
            let sse = (tile_meta.geometric_error)
                / (distance_from_camera * (frustum.sse_denominator / window.height)) as f64;
            (distance_from_camera, sse as f32)
        }
        None => (0., 0.),
    };

    tile.state.distance_from_camera = distance_from_camera;
    tile.state.sse = sse;

    let mut is_data_ready: bool = false;
    
    if tile.is_renderable_content {
        let data_requester = match tile.data_requester_id {
            Some(id) => requesters.get(id).ok().map(
                |d: (
                    &super::Cesium3dTileContentDataRequesterMarker,
                    &navara_data_requester::DataRequester,
                )| d.1,
            ),
            None => None,
        };
        is_data_ready = data_requester.is_some_and(|d| matches!(d.status, DataRequesterStatus::Success));
    } else {
        let uri = tile_meta.content.as_ref().map_or("".to_string(), |c| c.uri.clone()).split('?').next().unwrap_or("").split('/').last().unwrap_or("").to_string();
        let json_tile_set_constucted = sync_json_tilesets
            .json_node_to_tileset_state_map
            .get(&uri)
            .is_some_and(|state| state.is_constucted == true);

        if json_tile_set_constucted {
                let is_loaded = sync_json_tilesets
                .tileset_state_map
                .get(&uri)
                .is_some_and(|state| state.has_rendered_tiles == true);

            // info!("sync json tilesets: {:?}", sync_json_tilesets.tileset_state_map);
            is_data_ready = is_loaded;
            info!("non renderable content: checking if {} loaded: {}", uri, is_data_ready);
        }
            
        // is_data_ready = is_data_ready || uri.is_empty();
    }

    tile.state.is_data_loaded = is_data_ready;

    tile.state.touched = true;

    if !is_visible {
        return TraversalResult::Culled;
    }

    // filter out empty tiles - no content 
    if (sse <= max_sse) && tile.is_renderable_content {
        return TraversalResult::Selected;
    }

    if let Some(tile_meta_children) = &tile_meta.children {
        if tile.children.is_none() {
            tile.children = Some(Vec::with_capacity(tile_meta_children.len()));
        }

        let mut all_children_loaded = true;
        let mut any_children_selected = false;
        for (i, child_tile_meta) in tile_meta_children.iter().enumerate() {
            match tile.children.as_ref().unwrap().get(i) {
                Some(_) => {}
                None => {
                    let c = Cesium3dTileContent::new(child_tile_meta, Some(tile));
                    let tile_children = tile.children.as_mut().unwrap();
                    tile_children.push(c);
                }
            };

            let tile_children = tile.children.as_mut().unwrap();
            let child_tile = tile_children.get_mut(i).unwrap();

             match mark_leaves_2(
                commands,
                buf,
                sync_json_tilesets,
                base_url,
                layer_id,
                max_sse,
                child_tile_meta,
                child_tile,
                camera_position,
                frustum,
                requesters,
                window,
                rendered_tiles,
                features,
                renderable_features,
            ) {
                TraversalResult::Selected => {
                    child_tile.state.leaf = true;
                    any_children_selected = true;
                }
                TraversalResult::Culled => { 
                    if child_tile.state.sse <= max_sse || any_children_selected {
                        child_tile.state.leaf = true;
                        child_tile.state.is_visible = true;
                    } else {
                        continue;
                    }    
                 }
                TraversalResult::ChildrenSelected => { any_children_selected = true; }
                TraversalResult::ChildrenSelectedPartially => {} // not used here, remove later
            }

            let child_is_loaded = if child_tile.is_renderable_content {
                child_tile.state.is_data_loaded && child_tile.is_rendered(rendered_tiles, features, renderable_features)
            } else {
                child_tile.state.is_data_loaded
            };

            all_children_loaded = all_children_loaded
                && (child_tile.state.are_all_children_loaded || child_is_loaded);
        }

        tile.state.are_all_children_loaded = all_children_loaded;

        if matches!(tile.refine, Refine::Add) && any_children_selected {
            tile.state.leaf = true;
        }

        if any_children_selected {
            return TraversalResult::ChildrenSelected;
        } else {
            // tile does not meet sse but no children were selected, use this tile
            return TraversalResult::Selected;
        }
    }

    // Handle JSON child tiles
    if let Some(content) = &tile_meta.content {
        if content.uri.contains(".json") {
            if tile_meta.children.is_none() && tile.data_requester_id.is_none() {
                // spawn a data requester to load the child tileset json.
                let url = construct_child_tile_url(base_url, content.uri.as_str())
                    .as_str()
                    .to_string();

                let e = commands
                    .spawn((
                        Cesium3dTilesMetadataDataRequesterMarker(layer_id),
                        Priority::Low,
                        DataRequester::from_store(url, buf, DataRequesterExtension::Json),
                    ))
                    .id();
                tile.data_requester_id = Some(e);
                // TODO: trigger an event to indicate a child tileset json is requested, and some how be able to tie the json node to it's new tileset tree.
                let uri = content.uri.clone().split('?').next().unwrap_or("").split('/').last().unwrap_or("").to_string();
                // info!("Requesting child tileset json with uri: {}", uri);
                sync_json_tilesets
                    .json_node_to_tileset_state_map
                    .insert(uri, Cesium3dTilesJsonTileSetState::default());
            }
        }
    }

    return TraversalResult::Selected;
}


#[allow(clippy::too_many_arguments)]
fn mark_rendered_tiles(
    commands: &mut Commands,
    buf: &mut ResMut<BufferStore>,
    sync_json_tilesets: &mut ResMut<Cesium3dTilesJsonTileSet>,
    layer_id: Entity,
    base_url: &Url,
    tile: &mut Cesium3dTileContent,
    requesters: &Cesium3dTileContentRequesterQuery,
    rendered_tiles: &mut Query<&mut RenderedCesium3dTileContent>,
    rendered_tiles_count: &mut u32,
) {
    let touched_last_frame = tile.state.touched_last_frame;
    tile.state.touched_last_frame = tile.state.touched;

    let state = &tile.state;

    // This tile has been invisible before this frame.
    // if !state.touched && !touched_last_frame {
    // if !state.touched  {
    //     toggle_rendered_tile_visible(rendered_tiles, tile, false);
    //     return;
    // }

    let leaf = state.leaf;
    if (leaf || !tile.state.are_all_children_loaded) && tile.is_renderable_content {
        if state.is_data_loaded {
            let is_visible = state.is_visible;
            update_or_spawn_rendered_tile(commands, layer_id, rendered_tiles, tile, is_visible);
            if is_visible {
                *rendered_tiles_count += 1;
                let uri = base_url.as_str().to_string().split('?').next().unwrap_or("").to_string().split('/').last().unwrap_or("").to_string();
                sync_json_tilesets.tileset_state_map
                    .entry(uri)
                    .and_modify(|s| s.has_rendered_tiles = true)
                    .or_insert(Cesium3dTileSetState { has_rendered_tiles: true });
            }
        } else if state.is_visible {
            request_tile_content(
                commands,
                buf,
                base_url,
                tile,
                requesters,
                if tile.state.are_all_children_loaded {
                    Priority::Low
                } else {
                    Priority::Medium
                },
            );
        } else {
            toggle_rendered_tile_visible(rendered_tiles, tile, false);
        }
    } else {
        toggle_rendered_tile_visible(rendered_tiles, tile, false);
    }

    tile.state.touched = false;

    let children = match tile.children.as_mut() {
        Some(c) => c,
        None => return,
    };

    for child_tile in children.iter_mut() {
        mark_rendered_tiles(
            commands,
            buf,
            sync_json_tilesets,
            layer_id,
            base_url,
            child_tile,
            requesters,
            rendered_tiles,
            rendered_tiles_count,
        );
    }
}

#[allow(clippy::too_many_arguments)]
pub fn mark_rendered_tiles_invisible(
    tile: &mut Cesium3dTileContent,
    rendered_tiles: &mut Query<&mut RenderedCesium3dTileContent>,
) {
    toggle_rendered_tile_visible(rendered_tiles, tile, false);

    let children = match &mut tile.children {
        Some(c) => c,
        None => return,
    };

    for child_tile in children {
        mark_rendered_tiles_invisible(child_tile, rendered_tiles);
    }
}

fn toggle_rendered_tile_visible(
    rendered_tiles: &mut Query<&mut RenderedCesium3dTileContent>,
    tile: &mut Cesium3dTileContent,
    visible: bool,
) -> bool {
    let mut rendered_tile = tile
        .rendered_tile_id
        .and_then(|id| rendered_tiles.get_mut(id).ok());
    match &mut rendered_tile {
        Some(t) => {
            t.is_visible = visible;
            true
        }
        None => false,
    }
}

fn update_or_spawn_rendered_tile(
    commands: &mut Commands,
    layer_id: Entity,
    rendered_tiles: &mut Query<&mut RenderedCesium3dTileContent>,
    tile: &mut Cesium3dTileContent,
    visible: bool,
) {
    if toggle_rendered_tile_visible(rendered_tiles, tile, visible) {
        return;
    }

    if visible {
        if tile.uri.as_ref().unwrap().ends_with("pnts") {
            tile.rendered_tile_id = Some(
                commands
                    .spawn((
                        RenderedCesium3dTileContentPntsMarker,
                        TileOrderByDistance {
                            distance_from_camera: tile.state.distance_from_camera,
                            sse: tile.state.sse,
                        },
                        RenderedCesium3dTileContent {
                            layer_id,
                            feature_id: None,
                            data_requester_id: tile.data_requester_id.unwrap(),
                            is_visible: true,
                        },
                        TileTransform {
                            transform: tile.transform.unwrap_or_default(),
                        },
                    ))
                    .id(),
            );
        } else if tile.uri.as_ref().unwrap().ends_with("b3dm") {
            tile.rendered_tile_id = Some(
                commands
                    .spawn((
                        RenderedCesium3dTileContentB3dmMarker,
                        TileOrderByDistance {
                            distance_from_camera: tile.state.distance_from_camera,
                            sse: tile.state.sse,
                        },
                        RenderedCesium3dTileContent {
                            layer_id,
                            feature_id: None,
                            data_requester_id: tile.data_requester_id.unwrap(),
                            is_visible: true,
                        },
                    ))
                    .id(),
            );
        } else if tile.uri.as_ref().unwrap().contains("glb") {
            tile.rendered_tile_id = Some(
                commands
                    .spawn((
                        RenderedCesium3dTileContentGlbMarker,
                        TileOrderByDistance {
                            distance_from_camera: tile.state.distance_from_camera,
                            sse: tile.state.sse,
                        },
                        RenderedCesium3dTileContent {
                            layer_id,
                            feature_id: None,
                            data_requester_id: tile.data_requester_id.unwrap(),
                            is_visible: true,
                        },
                    ))
                    .id(),
            );
        } else {
            // TODO: support other formats like i3dm, cmpt, etc.
            unimplemented!("The tile format of {:?} isn't supported yet", tile.uri);
        }
    }
}

fn construct_child_tile_url(base_url: &Url, child_url: &str) -> Url {
    let mut new_url: Url = base_url.clone().join(child_url).unwrap();
    let base_query = base_url.query_pairs().into_owned();
    let new_query: HashMap<String, String> = new_url.query_pairs().into_owned().collect();
    for (key, value) in base_query {
        if new_query.contains_key(&key) {
            continue;
        }
        new_url
            .query_pairs_mut()
            .append_pair(key.as_ref(), value.as_ref());
    }
    new_url
}
