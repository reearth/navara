use std::collections::{HashMap, VecDeque};

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
    NotSelected,
    ChildrenSelected,
    ChildrenSelectedPartially,
    Culled,
    JsonChildFound,
}

#[allow(clippy::too_many_arguments)]
pub fn select_tiles(
    commands: &mut Commands,
    buf: &mut ResMut<BufferStore>,
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
    if let TraversalResult::Selected = mark_leaves(
        commands,
        layer_id,
        buf,
        max_sse,
        tile_meta,
        tile,
        base_url,
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
        layer_id,
        base_url,
        tile,
        requesters,
        rendered_tiles,
        &mut rendered_tiles_count,
    );
}

/// Breadth-first version of select_tiles
/// This traverses the tile tree level by level instead of depth-first
#[allow(clippy::too_many_arguments)]
pub fn select_tiles_bfs(
    commands: &mut Commands,
    buf: &mut ResMut<BufferStore>,
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
    // Helper struct to hold tile references and metadata for BFS traversal
    struct TileQueueItem<'a> {
        tile: *mut Cesium3dTileContent,
        tile_meta: &'a Cesium3dTileContentMetadata,
        parent_result: Option<TraversalResult>,
    }

    // Initialize BFS queue with root tile
    let mut queue: VecDeque<TileQueueItem> = VecDeque::new();
    queue.push_back(TileQueueItem {
        tile: tile as *mut Cesium3dTileContent,
        tile_meta,
        parent_result: None,
    });

    // Process tiles level by level
    while let Some(item) = queue.pop_front() {
        // SAFETY: We maintain exclusive access to tiles through the traversal
        let current_tile = unsafe { &mut *item.tile };

        // Process current tile
        let result = process_tile_bfs(
            commands,
            layer_id,
            buf,
            max_sse,
            item.tile_meta,
            current_tile,
            base_url,
            camera_position,
            frustum,
            requesters,
            window,
            rendered_tiles,
            features,
            renderable_features,
        );

        // Mark as leaf if selected
        if matches!(result, TraversalResult::Selected) {
            current_tile.state.leaf = true;
            // don't process children if this tile is selected
            continue;
        }

        if matches!(result, TraversalResult::NotSelected) && matches!(tile.refine, Refine::Add) {
            current_tile.state.leaf = true;
        }

        if matches!(result, TraversalResult::Culled) {
            continue;
        }

        // Add children to queue for next level
        if let Some(tile_meta_children) = &item.tile_meta.children {
            if current_tile.children.is_none() {
                current_tile.children = Some(Vec::with_capacity(tile_meta_children.len()));
            }
            for (i, child_tile_meta) in tile_meta_children.iter().enumerate() {
                // Ensure child exists
                match current_tile.children.as_ref().unwrap().get(i) {
                    Some(_) => {}
                    None => {
                        let c = Cesium3dTileContent::new(child_tile_meta, Some(current_tile));
                        let tile_children = current_tile.children.as_mut().unwrap();
                        tile_children.push(c);
                    }
                };

                let child_tile = &mut current_tile.children.as_mut().unwrap()[i];

                // Add child to queue for processing
                queue.push_back(TileQueueItem {
                    tile: child_tile as *mut Cesium3dTileContent,
                    tile_meta: child_tile_meta,
                    parent_result: Some(result),
                });
            }
        }
    }

    // Second pass: mark rendered tiles (still uses depth-first for rendering)
    let mut rendered_tiles_count = 0;
    mark_rendered_tiles_bfs(
        commands,
        buf,
        layer_id,
        base_url,
        tile,
        requesters,
        rendered_tiles,
        &mut rendered_tiles_count,
    );
}

/// Process a single tile in breadth-first traversal
/// This is similar to mark_leaves but without recursion
#[allow(clippy::too_many_arguments)]
fn process_tile_bfs(
    commands: &mut Commands,
    layer_id: Entity,
    buf: &mut ResMut<BufferStore>,
    max_sse: f32,
    tile_meta: &Cesium3dTileContentMetadata,
    tile: &mut Cesium3dTileContent,
    base_url: &Url,
    camera_position: Vec3,
    frustum: &CameraFrustum,
    requesters: &Cesium3dTileContentRequesterQuery,
    window: &Window,
    _rendered_tiles: &mut Query<&mut RenderedCesium3dTileContent>,
    _features: &Query<&FeatureId>,
    _renderable_features: &Query<&RenderableFeature>,
) -> TraversalResult {
    tile.reset_state();

    let is_visible =
        !matches!(&tile.bounding_volume, Some(aabb) if !frustum.intersection_with_aabb(aabb));
    if !is_visible {
        return TraversalResult::Culled;
    }

    tile.state.is_visible = is_visible;

    let (distance_from_camera, sse) = match &tile.bounding_volume {
        Some(aabb) => {
            let distance_from_camera = aabb.distance_to_point(camera_position);
            let sse = (tile_meta.geometric_error as f32)
                / (distance_from_camera * (frustum.sse_denominator / window.height));
            (distance_from_camera, sse)
        }
        None => (0., 0.),
    };
    tile.state.distance_from_camera = distance_from_camera;
    tile.state.sse = sse;

    let data_requester = match tile.data_requester_id {
        Some(id) => requesters.get(id).ok().map(
            |d: (
                &super::Cesium3dTileContentDataRequesterMarker,
                &navara_data_requester::DataRequester,
            )| d.1,
        ),
        None => None,
    };
    let is_data_ready =
        data_requester.is_some_and(|d| matches!(d.status, DataRequesterStatus::Success));
    tile.state.is_data_loaded = is_data_ready;

    tile.state.touched = true;

    let meets_sse = sse < max_sse;
    if meets_sse {
        return TraversalResult::Selected;
    }

    // Handle JSON child tiles
    if let Some(content) = &tile_meta.content {
        if tile_meta.children.is_none()
            && tile.data_requester_id.is_none()
            && content.uri.contains(".json")
        {
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
            // tile.state.is_data_loaded = true;
            return TraversalResult::JsonChildFound;
        }
    }

    // Note: Children state tracking would need to be done in a second pass
    // for a true BFS implementation, as we process level by level
    TraversalResult::NotSelected
}

#[allow(clippy::too_many_arguments)]
fn mark_leaves(
    commands: &mut Commands,
    layer_id: Entity,
    buf: &mut ResMut<BufferStore>,
    max_sse: f32,
    tile_meta: &Cesium3dTileContentMetadata,
    tile: &mut Cesium3dTileContent,
    base_url: &Url,
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
    if !is_visible {
        return TraversalResult::Culled;
    }

    tile.state.is_visible = is_visible;

    let (distance_from_camera, sse) = match &tile.bounding_volume {
        Some(aabb) => {
            let distance_from_camera = aabb.distance_to_point(camera_position);
            let sse = (tile_meta.geometric_error as f32)
                / (distance_from_camera * (frustum.sse_denominator / window.height));
            (distance_from_camera, sse)
        }
        None => (0., 0.),
    };
    tile.state.distance_from_camera = distance_from_camera;
    tile.state.sse = sse;

    let data_requester = match tile.data_requester_id {
        Some(id) => requesters.get(id).ok().map(
            |d: (
                &super::Cesium3dTileContentDataRequesterMarker,
                &navara_data_requester::DataRequester,
            )| d.1,
        ),
        None => None,
    };
    let is_data_ready =
        data_requester.is_some_and(|d| matches!(d.status, DataRequesterStatus::Success));
    tile.state.is_data_loaded = is_data_ready;

    tile.state.touched = true;

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

            match mark_leaves(
                commands,
                layer_id,
                buf,
                max_sse,
                child_tile_meta,
                child_tile,
                base_url,
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
                TraversalResult::Culled => {}
                TraversalResult::ChildrenSelectedPartially => {
                    any_children_rendered = true;
                    all_children_rendered = false;
                }
                TraversalResult::JsonChildFound => {
                    tile.state.any_children_has_json = true;
                }
                TraversalResult::NotSelected => {}
            };

            all_children_loaded = all_children_loaded
                && (child_tile.state.are_all_children_loaded || child_tile.state.is_data_loaded)
                && child_tile.is_rendered(rendered_tiles, features, renderable_features);
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

            if matches!(tile.refine, Refine::Replace) {
                return TraversalResult::Culled;
            }
        }
    }

    // No children available and tile content is another json file.
    if let Some(content) = &tile_meta.content {
        if tile_meta.children.is_none()
            && tile.data_requester_id.is_none()
            && content.uri.contains(".json")
        {
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
            tile.state.is_data_loaded = true;
            return TraversalResult::JsonChildFound;
        }
    }

    // Use this tile if children aren't found.
    TraversalResult::Selected
}

fn construct_child_tile_url(base_url: &Url, child_url: &str) -> Url {
    let mut new_url: Url = base_url.clone().join(child_url).unwrap();
    let base_query = base_url.query_pairs().into_owned();
    let new_query: HashMap<String, String> = new_url.query_pairs().into_owned().collect();
    for (key, value) in base_query {
        if (new_query.contains_key(&key)) {
            continue;
        }
        new_url
            .query_pairs_mut()
            .append_pair(key.as_ref(), value.as_ref());
    }
    return new_url;
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_uri_inherit_query_params() {
        let base_url = Url::parse(
            "https://tile.googleapis.com/v1/3dtiles/root.json?key=abc&session=old-session",
        )
        .unwrap();
        let target_url =
            "/v1/3dtiles/datasets/CgIYAQ/files/file.json?session=CJKIvdfhscLXThCIy6LIBgb";

        let result = construct_child_tile_url(&base_url, target_url);
        println!("Result URL: {}", result.as_str());
    }
}

#[allow(clippy::too_many_arguments)]
fn mark_rendered_tiles(
    commands: &mut Commands,
    buf: &mut ResMut<BufferStore>,
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
    if !state.touched && !touched_last_frame {
        toggle_rendered_tile_visible(rendered_tiles, tile, false);
        return;
    }

    let leaf = state.touched && state.leaf;

    if (leaf && tile.is_renderable_content) {
        if state.is_data_loaded {
            let is_visible = state.is_visible;
            update_or_spawn_rendered_tile(commands, layer_id, rendered_tiles, tile, is_visible);
            if is_visible {
                *rendered_tiles_count += 1;
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
        // tile.state.touched = false;
        // return;
    } else {
        toggle_rendered_tile_visible(rendered_tiles, tile, false);
    }

    tile.state.touched = false;

    let children = match tile.children.as_mut() {
        Some(c) => c,
        None => return,
    };

    let mut all_children_loaded = true;
    for child_tile in children.iter_mut() {
        all_children_loaded = all_children_loaded
            && child_tile.state.is_data_loaded
            && child_tile.is_renderable_content;
        mark_rendered_tiles(
            commands,
            buf,
            layer_id,
            base_url,
            child_tile,
            requesters,
            rendered_tiles,
            rendered_tiles_count,
        );
    }

    // if !all_children_loaded && !leaf && tile.is_renderable_content &&tile.state.is_data_loaded {
    //     info!("backup render tile");
    //     update_or_spawn_rendered_tile(commands, layer_id, rendered_tiles, tile, true);
    // } else if all_children_loaded && !leaf {
    //     toggle_rendered_tile_visible(rendered_tiles, tile, false);
    // }
}

#[allow(clippy::too_many_arguments)]
fn mark_rendered_tiles_bfs(
    commands: &mut Commands,
    buf: &mut ResMut<BufferStore>,
    layer_id: Entity,
    base_url: &Url,
    tile: &mut Cesium3dTileContent,
    requesters: &Cesium3dTileContentRequesterQuery,
    rendered_tiles: &mut Query<&mut RenderedCesium3dTileContent>,
    rendered_tiles_count: &mut u32,
) {
    // Helper struct to hold tile references and metadata for BFS traversal
    struct TileQueueItem {
        tile: *mut Cesium3dTileContent,
    }

    // Initialize BFS queue with root tile
    let mut queue: VecDeque<TileQueueItem> = VecDeque::new();

    queue.push_back(TileQueueItem {
        tile: tile as *mut Cesium3dTileContent,
    });

    // Process tiles level by level
    while let Some(item) = queue.pop_front() {
        // SAFETY: We maintain exclusive access to tiles through the traversal
        let current_tile = unsafe { &mut *item.tile };

        // Process current tile
        let tile_is_rendered = process_rendered_tile(
            commands,
            buf,
            layer_id,
            base_url,
            current_tile,
            requesters,
            rendered_tiles
        );

        // if the tile is rendered, skip processing its children
        if tile_is_rendered {
            continue;
        }

        let children = match current_tile.children.as_mut() {
            Some(c) => c,
            None => return,
        };

        let mut all_children_loaded = true;
        for child_tile in children.iter_mut() {
            // Add child to queue for processing
            queue.push_back(TileQueueItem {
                tile: child_tile as *mut Cesium3dTileContent,
            });
        }
    }
}

/// Breadth-first reverse version of mark_rendered_tiles
/// Collects all tiles level-by-level, then processes them from deepest to shallowest
#[allow(clippy::too_many_arguments)]
fn mark_rendered_tiles_reverse_bfs(
    commands: &mut Commands,
    buf: &mut ResMut<BufferStore>,
    layer_id: Entity,
    base_url: &Url,
    tile: &mut Cesium3dTileContent,
    requesters: &Cesium3dTileContentRequesterQuery,
    rendered_tiles: &mut Query<&mut RenderedCesium3dTileContent>,
    rendered_tiles_count: &mut u32,
) {
    // Helper struct to hold tile references for traversal
    struct TileQueueItem {
        tile: *mut Cesium3dTileContent,
    }

    // First pass: Collect all tiles in breadth-first order
    let mut queue: VecDeque<TileQueueItem> = VecDeque::new();
    let mut tiles_by_level: Vec<Vec<*mut Cesium3dTileContent>> = Vec::new();

    queue.push_back(TileQueueItem {
        tile: tile as *mut Cesium3dTileContent,
    });

    // Collect tiles level by level
    while !queue.is_empty() {
        let level_size = queue.len();
        let mut current_level = Vec::new();

        for _ in 0..level_size {
            if let Some(item) = queue.pop_front() {
                current_level.push(item.tile);

                // SAFETY: We maintain exclusive access to tiles through the traversal
                let current_tile = unsafe { &mut *item.tile };

                // Add children to queue for next level
                if let Some(children) = &mut current_tile.children {
                    for child in children.iter_mut() {
                        queue.push_back(TileQueueItem {
                            tile: child as *mut Cesium3dTileContent,
                        });
                    }
                }
            }
        }

        if !current_level.is_empty() {
            tiles_by_level.push(current_level);
        }
    }

    // Second pass: Process tiles in reverse order (deepest first)
    for level in tiles_by_level.iter().rev() {
        for tile_ptr in level {
            // SAFETY: We maintain exclusive access to tiles through the traversal
            let current_tile = unsafe { &mut **tile_ptr };

            process_rendered_tile(
                commands,
                buf,
                layer_id,
                base_url,
                current_tile,
                requesters,
                rendered_tiles,
            );
        }
    }
}

/// Helper function to process a single tile for rendering
/// Extracted from mark_rendered_tiles for reuse
#[allow(clippy::too_many_arguments)]
fn process_rendered_tile(
    commands: &mut Commands,
    buf: &mut ResMut<BufferStore>,
    layer_id: Entity,
    base_url: &Url,
    tile: &mut Cesium3dTileContent,
    requesters: &Cesium3dTileContentRequesterQuery,
    rendered_tiles: &mut Query<&mut RenderedCesium3dTileContent>,
) -> bool {
    let touched_last_frame = tile.state.touched_last_frame;
    tile.state.touched_last_frame = tile.state.touched;

    let state = &tile.state;

    // This tile has been invisible before this frame.
    if !state.touched && !touched_last_frame {
        toggle_rendered_tile_visible(rendered_tiles, tile, false);
        return false;
    }

    let leaf = state.touched && state.leaf;
    let mut tile_is_rendered = false;

    if leaf && tile.is_renderable_content {
        if state.is_data_loaded {
            let is_visible = state.is_visible;
            update_or_spawn_rendered_tile(commands, layer_id, rendered_tiles, tile, is_visible);
            tile_is_rendered = true;
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
    return tile_is_rendered;
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
            // info!("Spawning RenderedCesium3dTileContentGlbMarker for tile: {:?}", tile.uri);
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
