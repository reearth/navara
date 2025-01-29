use bevy_ecs::prelude::*;
use navara_buffer_store::BufferStore;
use navara_camera::CameraFrustum;
use navara_component::{OrderByDistance, Priority};
use navara_core::Ellipsoid;

use navara_data_requester::DataRequesterStatus;
use navara_feature_component::{id::FeatureId, render::RenderableFeature};
use navara_frame::FrameManager;
use navara_math::{FloatType, Transform};

use navara_layer::MvtLayer;
use navara_occluder::ellipsoidal_occluder::EllipsoidalOccluder;
use navara_tile_component::{Tile, TileHandle, VectorTile, VectorTileQuadtree};
use navara_window::Window;

use crate::{
    data_requester::{request_mvt_data, MvtDataRequesterQuery},
    layer::tile_cache_manager::TileCacheManager,
};

use super::{component::MVTFeatureMarker, render::RenderedTile};

// This process works in the following steps.
// 1. Check if the AABB of the tile is within the camera's frustum.(Frustum culling)
// 2. Check horizon culling because the frustum culling isn't enough.
// 3. Check SSE is within max SSE.
// 4. If SSE works and the tile is ready, the tile should be rendered.
// 5. On the other hand, if SSE works but the tile isn't loaded, the tile should be requested, not rendered.
// 6. If above steps aren't matched, traverse children.
// 7. If children couldn't be rendered completely, use this tile instead.
#[allow(clippy::too_many_arguments)]
pub fn traverse_tile(
    command: &mut Commands,
    layer: &MvtLayer,
    handle: TileHandle,
    qt: &mut VectorTileQuadtree,
    tc: &mut TileCacheManager,
    buf: &mut BufferStore,
    frame: &FrameManager,
    camera: &Transform,
    frustum: &CameraFrustum,
    window: &Window,
    ellipsoid: &Ellipsoid<FloatType>,
    occluder: &EllipsoidalOccluder,
    mvt_data_requester: &MvtDataRequesterQuery,
    rendered_tiles: &Query<&RenderedTile>,
    features: &Query<&FeatureId, With<MVTFeatureMarker>>,
    renderable_features: &mut Query<&mut RenderableFeature>,
) -> TraversalResult {
    // TODO: Fix unnecessary clone
    let vector_tile_appearance = layer.vector_tile_appearance().cloned().unwrap_or_default();
    match qt.qt.get(handle) {
        Some(tile) => {
            if tile.coords.z > vector_tile_appearance.max_zoom {
                return TraversalResult::NotFound;
            }
        }
        None => unreachable!(),
    };

    match qt.qt.get_mut(handle) {
        Some(tile) => begine_traverse_tile(ellipsoid, occluder, camera, tile),
        None => unreachable!(),
    };

    let tile = match qt.qt.get(handle) {
        Some(tile) => tile,
        None => unreachable!(),
    };

    let is_culled_by_frustum = !tile.intersect_with_camera_frustum(frustum);
    if is_culled_by_frustum {
        // Preload culled frustum nearby this tile.
        // Assuming the tile is far away.
        // let tile = qt.qt.get_mut(handle).unwrap();
        // tile.sse = 9999.;
        // tile.distance_from_camera = 9999.;
        // tile.visited_at = frame.rendered_frame();

        // prepare_tile_resource(
        //     command,
        //     tile,
        //     buf,
        //     layer,
        //     handle,
        //     tc,
        //     mvt_data_requester,
        //     Priority::Low,
        // );
        return TraversalResult::Culled;
    }

    let is_culled_by_occlusion = !tile
        .occludee_point_in_scaled_space
        .map(|p| occluder.is_scaled_space_point_visible(p))
        .unwrap_or(true);
    if is_culled_by_occlusion {
        return TraversalResult::Culled;
    }

    let data_requester = tile
        .data_requester_entity_id
        .and_then(|e| mvt_data_requester.get(e).ok());
    let is_tile_ready = data_requester.map_or(false, |(_, data_requester)| {
        tile.is_ready(&data_requester.status)
    });
    let is_tile_failed = data_requester.map_or(false, |(_, data_requester)| {
        matches!(data_requester.status, DataRequesterStatus::Fail)
    });

    let is_rendered_last_frame = tc.rendered_tile_caches.contains_key(&handle);

    let distance_from_camera = tile.calc_distance_from_camera(camera, ellipsoid);
    let sse = tile.calc_sse(frustum, window, ellipsoid, 64., distance_from_camera);

    let tile = qt.qt.get_mut(handle).unwrap();
    tile.sse = sse;
    tile.distance_from_camera = distance_from_camera;
    tile.visited_at = frame.rendered_frame();

    let max_sse = vector_tile_appearance.max_sse;
    let meets_sse = sse <= max_sse;

    let is_renderable = is_rendered_last_frame || is_tile_ready;

    if meets_sse {
        if is_renderable {
            return TraversalResult::TileRendered;
        }

        prepare_tile_resource(
            command,
            tile,
            buf,
            layer,
            handle,
            tc,
            mvt_data_requester,
            Priority::Low,
        );

        return TraversalResult::NotFound;
    }

    if let Some(children) = VectorTile::traversable_children(qt, handle) {
        let mut any_children_rendered = false;
        let mut are_all_children_rendered = true;
        let mut are_all_children_mesh_prepared = true;
        let mut rendered_children_indices = vec![];
        let mut hidden_children_indices = vec![];
        let mut prepared_children_indices = vec![];
        for (i, child) in children.iter().enumerate() {
            let traversal_result = traverse_tile(
                command,
                layer,
                *child,
                qt,
                tc,
                buf,
                frame,
                camera,
                frustum,
                window,
                ellipsoid,
                occluder,
                mvt_data_requester,
                rendered_tiles,
                features,
                renderable_features,
            );

            if matches!(traversal_result, TraversalResult::NotFound) {
                are_all_children_rendered = false;
                are_all_children_mesh_prepared = false;
            }

            if matches!(
                traversal_result,
                TraversalResult::NotFound | TraversalResult::Culled | TraversalResult::Failed
            ) {
                hidden_children_indices.push(i);
            }

            // If there is one child at least, trigger the rendering children process.
            if matches!(
                traversal_result,
                TraversalResult::TileRendered
                    | TraversalResult::ChildrenRendered
                    | TraversalResult::ChildrenMeshPrepared
                    | TraversalResult::Culled
            ) {
                any_children_rendered = true;
            }

            if matches!(traversal_result, TraversalResult::TileRendered)
                && !are_all_features_rendered(get_renderable_feature(
                    tc,
                    child,
                    rendered_tiles,
                    features,
                    renderable_features,
                ))
            {
                are_all_children_mesh_prepared = false;
                are_all_children_rendered = false;
            }

            // Skip rendering children in this tile.
            if matches!(
                traversal_result,
                TraversalResult::ChildrenRendered | TraversalResult::ChildrenMeshPrepared
            ) {
                rendered_children_indices.push(i);
            }

            if matches!(traversal_result, TraversalResult::ChildrenRendered) {
                are_all_children_mesh_prepared = false;
            }

            if matches!(traversal_result, TraversalResult::ChildrenMeshPrepared) {
                prepared_children_indices.push(i);
            }
        }

        if any_children_rendered {
            for (i, child) in children.iter().enumerate() {
                // If this child is not renderable, skip rendering this child.
                if hidden_children_indices.contains(&i) {
                    continue;
                }

                // If this child's children are rendered, skip rendering this child.
                if rendered_children_indices.contains(&i) {
                    continue;
                }

                let handle = *child;
                let tile = match qt.qt.get_mut(handle) {
                    Some(t) => t,
                    None => unreachable!(),
                };
                spawn_tile_entity(command, tc, tile, frame, handle);
            }

            for (i, child) in children.iter().enumerate() {
                let are_active = are_all_renderable_features_active(
                    tc,
                    child,
                    rendered_tiles,
                    features,
                    renderable_features,
                );

                // If this child is not renderable, skip rendering this child.
                if prepared_children_indices.contains(&i) || hidden_children_indices.contains(&i) {
                    if matches!(are_active, Some(true)) {
                        activate_all_renderable_features(
                            tc,
                            child,
                            rendered_tiles,
                            features,
                            renderable_features,
                            false,
                        );
                    }
                    continue;
                }

                // To avoid committing unnecessary events, invoke `activate` only when `is_active` is true.
                if are_active.map_or(false, |v| v != are_all_children_mesh_prepared) {
                    activate_all_renderable_features(
                        tc,
                        child,
                        rendered_tiles,
                        features,
                        renderable_features,
                        are_all_children_mesh_prepared,
                    );
                }
            }

            if are_all_children_mesh_prepared {
                return TraversalResult::ChildrenMeshPrepared;
            }

            if are_all_children_rendered {
                // This tile's children are rendered completely, so parent tile isn't rendered.
                return TraversalResult::ChildrenRendered;
            }
        }
    }

    if is_tile_failed {
        return TraversalResult::Failed;
    }

    if !is_renderable {
        let tile = qt.qt.get_mut(handle).unwrap();
        prepare_tile_resource(
            command,
            tile,
            buf,
            layer,
            handle,
            tc,
            mvt_data_requester,
            Priority::Medium,
        );

        return TraversalResult::NotFound;
    }

    TraversalResult::TileRendered
}

fn get_renderable_feature<'a>(
    tc: &TileCacheManager,
    handle: &TileHandle,
    rendered_tiles: &Query<&RenderedTile>,
    features: &Query<&FeatureId, With<MVTFeatureMarker>>,
    renderable_features: &'a mut Query<&mut RenderableFeature>,
) -> Option<Vec<&'a RenderableFeature>> {
    tc.rendered_tile_caches
        .get(handle)
        .and_then(|e| rendered_tiles.get(*e).ok())
        .and_then(|v| v.feature_ids.as_ref())
        .and_then(|es| {
            es.iter()
                .map(|e| features.get(*e).ok())
                .collect::<Option<Vec<_>>>()
        })
        .and_then(|fs| fs.iter().map(|f| f.0).collect::<Option<Vec<_>>>())
        .and_then(|ids| {
            ids.into_iter()
                .map(|id| renderable_features.get(id).ok())
                .collect::<Option<Vec<_>>>()
        })
}

fn activate_all_renderable_features(
    tc: &TileCacheManager,
    handle: &TileHandle,
    rendered_tiles: &Query<&RenderedTile>,
    features: &Query<&FeatureId, With<MVTFeatureMarker>>,
    renderable_features: &mut Query<&mut RenderableFeature>,
    active: bool,
) {
    let _ = tc
        .rendered_tile_caches
        .get(handle)
        .and_then(|e| rendered_tiles.get(*e).ok())
        .and_then(|v| v.feature_ids.as_ref())
        .and_then(|es| {
            es.iter()
                .map(|e| features.get(*e).ok())
                .collect::<Option<Vec<_>>>()
        })
        .and_then(|fs| fs.iter().map(|f| f.0).collect::<Option<Vec<_>>>())
        .map(|ids| {
            for id in ids {
                let Some(mut r) = renderable_features.get_mut(id).ok() else {
                    unreachable!("It must be set");
                };
                r.activate(active);
            }
        });
}

fn are_all_renderable_features_active(
    tc: &TileCacheManager,
    handle: &TileHandle,
    rendered_tiles: &Query<&RenderedTile>,
    features: &Query<&FeatureId, With<MVTFeatureMarker>>,
    renderable_features: &mut Query<&mut RenderableFeature>,
) -> Option<bool> {
    tc.rendered_tile_caches
        .get(handle)
        .and_then(|e| rendered_tiles.get(*e).ok())
        // Assume that all values have same activation with first one.
        .and_then(|v| v.feature_ids.as_ref().and_then(|i| i.first()))
        .and_then(|e| features.get(*e).ok())
        .and_then(|f| f.0)
        .and_then(|id| renderable_features.get(id).ok().map(|r| r.is_active()))
}

fn are_all_features_rendered(renderable_features: Option<Vec<&RenderableFeature>>) -> bool {
    renderable_features
        .map(|rs| rs.iter().all(|r| r.is_rendered()))
        .unwrap_or(false)
}

// We should use entity to store the rendered tile, because the Bevy's entity is extensible.
pub fn spawn_tile_entity(
    commands: &mut Commands,
    tc: &mut TileCacheManager,
    tile: &mut VectorTile,
    frame: &FrameManager,
    tile_handle: TileHandle,
) {
    tile.rendered_at = frame.rendered_frame();
    tc.is_updated_in_this_frame = true;

    if tc.rendered_tile_caches.contains_key(&tile_handle) {
        return;
    }

    let e = commands.spawn((
        RenderedTile {
            tile_handle,
            ..Default::default()
        },
        OrderByDistance {
            sse: tile.sse,
            distance: tile.distance_from_camera,
        },
    ));
    tc.rendered_tile_caches.insert(tile_handle, e.id());
}

/// Prepare some resource that is necessary to render the tile.
/// This returns whether the resource is requested or not.
#[allow(clippy::too_many_arguments)]
pub fn prepare_tile_resource(
    commands: &mut Commands,
    tile: &mut VectorTile,
    buf: &mut BufferStore,
    layer: &MvtLayer,
    handle: TileHandle,
    tc: &mut TileCacheManager,
    data_requesters: &MvtDataRequesterQuery,
    priority: Priority,
) -> bool {
    let requested_mvt = request_mvt_data(
        commands,
        tile,
        buf,
        layer,
        handle,
        data_requesters,
        priority,
    );

    if let Some(e) = requested_mvt {
        tc.requested_tile_caches.insert(handle, e);
    }

    requested_mvt.is_some()
}

fn begine_traverse_tile(
    ellipsoid: &Ellipsoid<FloatType>,
    occluder: &EllipsoidalOccluder,
    _camera: &Transform,
    tile: &mut VectorTile,
) {
    tile.update_tile_occludee_point(ellipsoid, occluder);
}

pub(super) enum TraversalResult {
    TileRendered,
    ChildrenRendered,
    ChildrenMeshPrepared,
    Culled,
    NotFound,
    Failed,
}
