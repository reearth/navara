use bevy_ecs::{
    entity::Entity,
    system::{Commands, Query, ResMut},
};
use navara_buffer_store::BufferStore;
use navara_camera::CameraFrustum;
use navara_component::Priority;
use navara_data_requester::DataRequesterStatus;
use navara_feature_component::{id::FeatureId, render::RenderableFeature};
use navara_math::Vec3;
use navara_parser::cesium3dtiles::tileset::Refine;
use navara_window::Window;
use url::Url;

use crate::{b3dm::RenderedCesium3dTileContentB3dmMarker, RenderedCesium3dTileContent};

use super::{
    request_tile_content, types::Cesium3dTileContentRequesterQuery, Cesium3dTileContent,
    Cesium3dTileContentMetadata, TileOrderByDistance,
};

pub enum TraversalResult {
    Selected,
    ChildrenSelected,
    ChildrenSelectedPartially,
    Culled,
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
                TraversalResult::Culled => {}
                TraversalResult::ChildrenSelectedPartially => {
                    any_children_rendered = true;
                    all_children_rendered = false;
                }
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
        }
    }

    // Use this tile if children aren't found.
    TraversalResult::Selected
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
    if (leaf || !tile.state.are_all_children_loaded) && tile.is_renderable_content {
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
    }
}
