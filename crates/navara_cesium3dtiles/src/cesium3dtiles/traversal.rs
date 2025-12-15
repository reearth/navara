use std::collections::HashMap;

use bevy_ecs::{
    entity::Entity,
    system::{Commands, Query, ResMut},
};

use navara_buffer_store::BufferStore;
use navara_camera::CameraFrustum;
use navara_component::{Deleted, Priority};
use navara_data_requester::DataRequesterStatus;
use navara_feature_component::{id::FeatureId, render::RenderableFeature};
use navara_math::Vec3;
use navara_parser::cesium3dtiles::tileset::Refine;
use navara_window::Window;
use url::Url;

use crate::{
    b3dm::RenderedCesium3dTileContentB3dmMarker, glb::RenderedCesium3dTileContentGlbMarker,
    pnts::RenderedCesium3dTileContentPntsMarker, Cesium3dTilesJsonTileSetStateMap,
    Cesium3dTilesJsonTileSetStateMapKey, Cesium3dTilesTreeOrder, RenderedCesium3dTileContent,
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
    TreeSelected,
    ChildrenSelectedPartially,
    NotFound,
    Culled,
}

#[allow(clippy::too_many_arguments)]
pub fn select_tiles(
    commands: &mut Commands,
    buf: &mut ResMut<BufferStore>,
    sync_json_tilesets: &mut ResMut<Cesium3dTilesJsonTileSetStateMap>,
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
    current_tree_order: &Cesium3dTilesTreeOrder,
) {
    let mut rendered_tiles_count = 0;

    // This is used to keep tracking the order of child trees.
    let next_tree_order = current_tree_order.index;

    let traversal_result = mark_leaves(
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
        next_tree_order,
    );

    let key = Cesium3dTilesJsonTileSetStateMapKey::from_path(layer_id, base_url.path());

    let is_root_tree = current_tree_order.index == 0;

    let cloned_key = key.clone();
    let mark_as_ready_tree = |v: bool| {
        if is_root_tree {
            return;
        }
        if let Some(key) = cloned_key {
            // Notify the state of this tile to the parent tree.
            sync_json_tilesets.set_has_rendered_tiles(key, v);
        }
    };

    match traversal_result {
        TraversalResult::Selected => {
            mark_as_ready_tree(tile.is_rendered(rendered_tiles, features, renderable_features));
            tile.state.leaf = true;
        }
        TraversalResult::ChildrenSelected | TraversalResult::TreeSelected => {
            mark_as_ready_tree(true);
        }
        _ => {}
    };
    mark_rendered_tiles(
        commands,
        buf,
        layer_id,
        base_url,
        sync_json_tilesets,
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
    sync_json_tilesets: &mut ResMut<Cesium3dTilesJsonTileSetStateMap>,
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
    next_tree_order: usize,
) -> TraversalResult {
    tile.reset_state();

    let is_visible =
        matches!(&tile.bounding_volume, Some(aabb) if frustum.intersection_with_aabb(aabb));

    tile.state.is_visible = is_visible;

    if !is_visible {
        return TraversalResult::Culled;
    }

    let (distance_from_camera, sse) = match &tile.bounding_volume {
        Some(aabb) => {
            let distance_from_camera = aabb.distance_to_point(camera_position);
            let sse = (tile_meta.geometric_error)
                / (distance_from_camera * (frustum.sse_denominator / window.height));
            (distance_from_camera as f32, sse as f32)
        }
        None => (0., 0.),
    };

    tile.state.distance_from_camera = distance_from_camera;
    tile.state.sse = sse;

    let is_data_ready: bool = if tile.is_renderable_content {
        let data_requester = match tile.data_requester_id {
            Some(id) => requesters.get(id).ok().map(
                |d: (
                    &super::Cesium3dTileContentDataRequesterMarker,
                    &navara_data_requester::DataRequester,
                )| d.1,
            ),
            None => None,
        };
        data_requester.is_some_and(|d| matches!(d.status, DataRequesterStatus::Success))
    } else if let Some(key) = Cesium3dTilesJsonTileSetStateMapKey::from_tile(layer_id, tile_meta) {
        // Check the child tree state.
        let is_loaded = sync_json_tilesets
            .get_tileset_state(&key)
            .is_some_and(|state| state.has_rendered_tiles);

        is_loaded
    } else {
        false
    };

    let next_tree_order = next_tree_order + 1;

    tile.state.is_data_loaded = is_data_ready;

    tile.state.touched = true;

    let meets_sse = sse <= max_sse;

    let is_rendered = if tile.is_renderable_content {
        tile.state.is_rendered_last_frame
    } else {
        tile.state.is_data_loaded
    };

    // filter out empty tiles - no content
    if meets_sse && tile.is_renderable_content {
        return TraversalResult::Selected;
    }

    if let Some(tile_meta_children) = &tile_meta.children {
        if tile.children.is_none() {
            tile.children = Some(Vec::with_capacity(tile_meta_children.len()));
        }

        let mut all_children_rendered = true;
        let mut any_children_selected = false;
        let mut selected_children = vec![];
        let mut selected_tree_children = vec![];
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
                next_tree_order,
            ) {
                TraversalResult::Selected => {
                    selected_children.push(i);
                    any_children_selected = true;
                    if !child_tile.is_rendered(rendered_tiles, features, renderable_features) {
                        all_children_rendered = false;
                    }
                }
                TraversalResult::Culled => {
                    // The tile should be rendered once all children is ready if `refine` is `REPLACE`.
                    // The culled tile should be regarded as a ready tile. Then children can replace the parent
                    // even if the children includes a culled tile.
                    continue;
                }
                TraversalResult::NotFound => {
                    all_children_rendered = false;
                }
                TraversalResult::ChildrenSelected => {
                    any_children_selected = true;
                }
                TraversalResult::TreeSelected => {
                    selected_tree_children.push(i);
                    any_children_selected = true;
                }
                TraversalResult::ChildrenSelectedPartially => {
                    any_children_selected = true;
                    all_children_rendered = false;
                }
            }
        }

        tile.state.are_all_children_loaded = all_children_rendered;

        if any_children_selected {
            for (i, child) in tile.children.as_mut().unwrap().iter_mut().enumerate() {
                // Render child when all children is ready.
                let is_selected_child = selected_children.contains(&i);
                if matches!(child.refine, Refine::Replace)
                    && is_selected_child
                    // Children is rendered once the parent tile becomes ready.
                    && (is_rendered || all_children_rendered)
                {
                    child.state.leaf = true;
                    continue;
                }

                if matches!(child.refine, Refine::Add) && is_selected_child {
                    child.state.leaf = true;
                }
            }

            if matches!(tile.refine, Refine::Replace) && all_children_rendered {
                return TraversalResult::ChildrenSelected;
            }

            if matches!(tile.refine, Refine::Add) {
                return TraversalResult::ChildrenSelectedPartially;
            }
        } else {
            // tile does not meet sse but no children were selected, use this tile
            return TraversalResult::Selected;
        }
    }

    // Handle JSON child tiles
    if let Some(uri) = &tile_meta
        .content
        .as_ref()
        .map(|c| c.uri.as_ref().unwrap_or_else(|| c.url.as_ref().unwrap()))
    {
        if uri.contains(".json") && tile_meta.children.is_none() && tile.data_requester_id.is_none()
        {
            // spawn a data requester to load the child tileset json.
            let url = construct_child_tile_url(base_url, uri.as_str())
                .as_str()
                .to_string();

            let e = commands
                .spawn((
                    Cesium3dTilesMetadataDataRequesterMarker(layer_id),
                    Priority::High,
                    Cesium3dTilesTreeOrder {
                        index: next_tree_order,
                        distance: TileOrderByDistance {
                            distance_from_camera,
                            sse,
                        },
                    },
                    DataRequester::from_store(url, buf, DataRequesterExtension::Json),
                ))
                .id();
            tile.data_requester_id = Some(e);
        }
    }

    if !tile.is_renderable_content {
        if is_data_ready {
            return TraversalResult::TreeSelected;
        } else {
            // The parent tile should be rendered until this JSON is ready.
            return TraversalResult::NotFound;
        }
    }

    TraversalResult::Selected
}

#[allow(clippy::too_many_arguments)]
fn mark_rendered_tiles(
    commands: &mut Commands,
    buf: &mut ResMut<BufferStore>,
    layer_id: Entity,
    base_url: &Url,
    sync_json_tilesets: &mut ResMut<Cesium3dTilesJsonTileSetStateMap>,
    tile: &mut Cesium3dTileContent,
    requesters: &Cesium3dTileContentRequesterQuery,
    rendered_tiles: &mut Query<&mut RenderedCesium3dTileContent>,
    rendered_tiles_count: &mut u32,
) {
    let touched_last_frame = tile.state.touched_last_frame;
    tile.state.touched_last_frame = tile.state.touched;

    let state = &tile.state;

    let touched = state.touched || touched_last_frame;
    let leaf = state.leaf;

    let mut is_rendered = touched && state.is_rendered_last_frame;

    if tile.is_renderable_content {
        if touched && (leaf || !state.are_all_children_loaded) {
            if state.is_data_loaded {
                let is_visible = state.is_visible;
                update_or_spawn_rendered_tile(commands, layer_id, rendered_tiles, tile, is_visible);
                if is_visible {
                    *rendered_tiles_count += 1;
                    is_rendered = true;
                }
            } else if state.is_visible {
                request_tile_content(
                    commands,
                    buf,
                    base_url,
                    tile,
                    requesters,
                    if leaf {
                        Priority::Medium
                    } else {
                        Priority::Low
                    },
                );
            } else {
                toggle_rendered_tile_visible(rendered_tiles, tile, false);
            }
        } else {
            toggle_rendered_tile_visible(rendered_tiles, tile, false);
        }
    } else if !touched {
        // If this tile is out of touch and it is JSON, remove the resource from memory.

        if let Some(id) = tile.data_requester_id.take() {
            let _ = commands.get_entity(id).as_mut().map(|e| e.insert(Deleted));
        }
        if let Some(key) = tile
            .uri
            .as_ref()
            .and_then(|url| Cesium3dTilesJsonTileSetStateMapKey::from_path(layer_id, url))
        {
            sync_json_tilesets.remove_tileset_state(&key);
        }
        tile.state.is_data_loaded = false;
        tile.state.is_visible = false;
    }

    tile.state.touched = false;
    tile.state.is_rendered_last_frame = is_rendered;

    let children = match tile.children.as_mut() {
        Some(c) => c,
        None => return,
    };

    for child_tile in children.iter_mut() {
        mark_rendered_tiles(
            commands,
            buf,
            layer_id,
            base_url,
            sync_json_tilesets,
            child_tile,
            requesters,
            rendered_tiles,
            rendered_tiles_count,
        );
    }

    // Reset children once it is out of touch.
    if !touched {
        tile.children = None;
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
            let aabb = tile.bounding_volume.as_ref().unwrap();
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
                        aabb.clone(),
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
