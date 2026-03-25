use bevy_ecs::prelude::*;
use navara_component::{OrderByDistance, Priority};
use navara_core::Ellipsoid;

use navara_buffer_store::BufferStore;
use navara_feature_component::{id::FeatureId, render::RenderableFeature};
use navara_fog::Fog;
use navara_frame::FrameManager;
use navara_globe::Globe;
use navara_math::{FloatType, Transform};

use navara_layer::TerrainLayer;
use navara_occluder::ellipsoidal_occluder::EllipsoidalOccluder;
use navara_tile_component::{
    TerrainInformation, TerrainInformationQuadtree, Tile, TileHandle, VectorTile,
    VectorTileQuadtree,
};
use navara_window::Window;

use crate::{
    component::VectorTileFeatureMarker, data_requester::VectorTileDataRequesterQuery,
    layer::tile_cache_manager::TileCacheManager, source::ReadyState, source_cache::SourceId,
};

use super::render::RenderedTile;

// This process works in the following steps.
// 1. Check if the AABB of the tile is within the camera's frustum.(Frustum culling)
// 2. Check horizon culling because the frustum culling isn't enough.
// 3. Check SSE is within max SSE.
// 4. If SSE works and the tile is ready, the tile should be rendered.
// 5. On the other hand, if SSE works but the tile isn't loaded, the tile should be requested, not rendered.
// 6. If above steps aren't matched, traverse children.
// 7. If children couldn't be rendered completely, use this tile instead.
// 8. If all children is rendered, use children.
// 9. If the tile is overscaled, it's leaf is marked just in quadtree, but it isn't actually rendered. It reuses a parent tile.

#[allow(clippy::too_many_arguments)]
pub fn traverse_tile(
    command: &mut Commands,
    source_id: &SourceId,
    handle: TileHandle,
    qt: &mut VectorTileQuadtree,
    tc: &mut TileCacheManager,
    frame: &FrameManager,
    camera: &Transform,
    frustum: &navara_camera::CameraFrustum,
    window: &Window,
    ellipsoid: &Ellipsoid<FloatType>,
    occluder: &EllipsoidalOccluder,
    data_requesters: &VectorTileDataRequesterQuery,
    rendered_tiles: &Query<&RenderedTile>,
    features: &Query<&FeatureId, With<VectorTileFeatureMarker>>,
    renderable_features: &mut Query<&mut RenderableFeature>,
    fog: &Fog,
    // This is used to keep rendering current children when parent tile isn't ready after you zoomed out.
    meets_sse_ancestors: bool,
    terrain_layer: &Option<&TerrainLayer>,
    terrain_qt: &TerrainInformationQuadtree,
    ready_parent_tile_handle: Option<TileHandle>,
    globe: &Globe,
    source: &mut dyn crate::source::VectorTileSource,
    buf: &mut BufferStore,
) -> TraversalResult {
    let tile = qt.qt.get_mut(handle).unwrap();
    tile.ready_parent_tile_handle = if source.should_upscale(tile) {
        ready_parent_tile_handle
    } else {
        // Clear parent handle if the source says this tile shouldn't upscale
        None
    };
    tile.is_rendered = false;

    let traversal_config = source_id.traversal_config();

    // Clamped to ground polygon need to be overscaled, since it is rendered as texture.
    let is_texturized = traversal_config.has_clamp_to_ground;

    if tile.coords.z > traversal_config.max_zoom && !is_texturized {
        return TraversalResult::NotFound;
    }

    // Reference the terrain information from the raster tile process.
    let terrain_info = terrain_qt.qt.get(handle).map_or_else(
        || {
            let e = terrain_qt
                .qt
                .parent((tile.coords.x, tile.coords.y, tile.coords.z))?;
            terrain_qt.qt.get(e.handle())
        },
        Some,
    );
    begin_traverse_tile(ellipsoid, occluder, camera, tile, terrain_info);

    let is_culled_by_frustum = !tile.intersect_with_camera_frustum(frustum);
    if is_culled_by_frustum {
        return TraversalResult::Culled;
    }

    let is_culled_by_occlusion = !tile
        .occludee_point_in_scaled_space
        .map(|p| occluder.is_scaled_space_point_visible(p))
        .unwrap_or(true);
    if is_culled_by_occlusion {
        return TraversalResult::Culled;
    }

    let is_overscaled = ready_parent_tile_handle.is_some()
        && tile.coords.z > traversal_config.max_zoom
        && tile.coords.z <= traversal_config.overscaled_max_zoom;

    if tile.coords.z > traversal_config.max_zoom && !is_overscaled {
        return TraversalResult::NotFound;
    }

    let ready_state = source.ready_state(tile, data_requesters);
    let is_tile_ready = matches!(ready_state, ReadyState::Success);
    let is_tile_failed = matches!(ready_state, ReadyState::Failed);

    let is_rendered_last_frame = tc.rendered_tile_caches.contains_key(&handle);

    let distance_from_camera = tile.calc_distance_from_camera(camera, ellipsoid);
    let sse = tile.calc_sse(
        frustum,
        window,
        ellipsoid,
        if terrain_layer.is_some() { 65. } else { 64. },
        distance_from_camera,
        fog,
    );

    tile.sse = sse;
    tile.distance_from_camera = distance_from_camera;
    tile.visited_at = frame.rendered_frame();

    let were_children_rendered = tile.were_children_rendered;

    // If it is texturized, max SSE need to be same with Globe.
    let max_sse = if is_texturized {
        globe.max_sse
    } else {
        traversal_config.max_sse()
    } as f64;
    let meets_sse = sse <= max_sse;

    let is_renderable = is_rendered_last_frame || is_tile_ready;

    if meets_sse || meets_sse_ancestors {
        // The overscaled tile means that the tiles reached the max zoom level,
        // so there is no next tile.
        // The tile itself is upscaled without fetching new tile.
        if is_overscaled {
            return TraversalResult::Overscaled;
        }

        if is_renderable
            // Keep rendering children while preparing the tile if it's available, because rendering tile takes some time.
            && !were_children_rendered
        {
            // Avoid to return an inactivated tile when meets SSE from ancestors.
            if meets_sse_ancestors
                && !matches!(
                    are_all_renderable_features_active(
                        tc,
                        &handle,
                        rendered_tiles,
                        features,
                        renderable_features
                    ),
                    Some(true)
                )
            {
                return TraversalResult::NotFound;
            }

            return TraversalResult::TileRendered;
        }

        if !meets_sse_ancestors {
            let tile = qt.qt.get_mut(handle).unwrap();
            source.prepare_tile(
                command,
                tile,
                handle,
                tc,
                buf,
                data_requesters,
                Priority::Low,
            );
        }

        if !were_children_rendered {
            return TraversalResult::NotFound;
        }
    }

    if let Some(children) = VectorTile::traversable_children(qt, handle) {
        let are_feature_activated = !is_overscaled
            && matches!(
                are_all_renderable_features_active(
                    tc,
                    &handle,
                    rendered_tiles,
                    features,
                    renderable_features,
                ),
                Some(true)
            );

        let ready_parent_tile_handle = if are_feature_activated {
            Some(handle)
        } else {
            ready_parent_tile_handle
        };

        let mut any_children_rendered = false;

        // Tile has several states to switch LOD smoothly.
        // 1. RenderedTile component is spawned if a tile is selected.
        // 2. Rendering engine needs to do some preparations, so the selected tile is marked as it's prepared after these preparations.
        // 3. The selected tile is activated if all other same level children are activated as well.
        // 4. When the selected tile is activated, the tile will be visible.
        let mut are_all_children_rendered = true;
        let mut are_all_children_mesh_prepared = true;
        let mut are_all_children_activated = true;

        let mut rendered_children_indices = vec![];
        let mut hidden_children_indices = vec![];
        let mut prepared_children_indices = vec![];

        // Overscaled tile is actually not rendered, since parent tile is reused in the rendering engine side.
        let mut overscaled_children_indices = vec![];

        for (i, child) in children.iter().enumerate() {
            let traversal_result = traverse_tile(
                command,
                source_id,
                *child,
                qt,
                tc,
                frame,
                camera,
                frustum,
                window,
                ellipsoid,
                occluder,
                data_requesters,
                rendered_tiles,
                features,
                renderable_features,
                fog,
                meets_sse,
                terrain_layer,
                terrain_qt,
                ready_parent_tile_handle,
                globe,
                source,
                buf,
            );

            if matches!(traversal_result, TraversalResult::NotFound) {
                are_all_children_rendered = false;
                are_all_children_mesh_prepared = false;
                are_all_children_activated = false;
            }

            if matches!(
                traversal_result,
                TraversalResult::NotFound | TraversalResult::Culled | TraversalResult::Failed
            ) {
                hidden_children_indices.push(i);
            }

            if matches!(traversal_result, TraversalResult::Overscaled) {
                overscaled_children_indices.push(i);
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
                are_all_children_activated = false;
            }

            // If tile's mesh isn't ready, render the parent tile.
            if (matches!(traversal_result, TraversalResult::TileRendered)
                && !matches!(
                    are_all_renderable_features_active(
                        tc,
                        child,
                        rendered_tiles,
                        features,
                        renderable_features
                    ),
                    Some(true)
                ))
            {
                are_all_children_activated = false;
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

        // This condition should be avoided when overscaled children are selected.
        // We assume vector tiles is continuous data, so a tile that is over `max_zoom` is assumed an overscaled tile.
        if any_children_rendered && overscaled_children_indices.is_empty() {
            if are_all_children_activated && !meets_sse && !meets_sse_ancestors {
                let tile = qt.qt.get_mut(handle).unwrap();
                tile.were_children_rendered = true;
            }

            if !meets_sse && !meets_sse_ancestors {
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
            }

            for (i, child) in children.iter().enumerate() {
                let activation_state = get_renderable_feature_activation_state(
                    tc,
                    child,
                    rendered_tiles,
                    features,
                    renderable_features,
                );

                let tile = qt.qt.get_mut(*child).unwrap();
                tile.is_rendered = are_all_children_mesh_prepared;

                // If this child is not renderable, skip rendering this child.
                if prepared_children_indices.contains(&i) || hidden_children_indices.contains(&i) {
                    if activation_state.is_some_and(|state| state.any_active) {
                        tile.is_rendered = false;
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

                let needs_activation_update = activation_state
                    .is_some_and(|state| state.all_active != are_all_children_mesh_prepared);

                if needs_activation_update {
                    // Re-run this traverse if `active` is updated, because the child tiles are updated depending on the parent state.
                    tc.needs_update = true;

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

            // Avoid to render new children while waiting for parent tile is activated.
            if meets_sse_ancestors && are_all_children_activated {
                return TraversalResult::ChildrenMeshPrepared;
            }

            if !meets_sse && !meets_sse_ancestors {
                if are_all_children_mesh_prepared {
                    return TraversalResult::ChildrenMeshPrepared;
                }

                if are_all_children_rendered {
                    // This tile's children are rendered completely, so parent tile isn't rendered.
                    return TraversalResult::ChildrenRendered;
                }
            }
        }
    }

    if is_overscaled {
        return TraversalResult::Overscaled;
    }

    if is_tile_failed {
        return TraversalResult::Failed;
    }

    if !is_renderable {
        // Avoid to request or render new tile while waiting for parent tile is activated.
        if meets_sse_ancestors {
            return TraversalResult::NotFound;
        }

        let tile = qt.qt.get_mut(handle).unwrap();
        source.prepare_tile(
            command,
            tile,
            handle,
            tc,
            buf,
            data_requesters,
            Priority::Medium,
        );

        return TraversalResult::NotFound;
    }

    let is_activated = matches!(
        are_all_renderable_features_active(
            tc,
            &handle,
            rendered_tiles,
            features,
            renderable_features
        ),
        Some(true)
    );

    if meets_sse && !meets_sse_ancestors && is_activated {
        let tile = qt.qt.get_mut(handle).unwrap();
        tile.were_children_rendered = false;
    }

    // Avoid to return an inactivated tile when meets SSE from ancestors.
    if meets_sse_ancestors && !is_activated {
        return TraversalResult::NotFound;
    }

    TraversalResult::TileRendered
}

pub fn get_renderable_feature<'a>(
    tc: &TileCacheManager,
    handle: &TileHandle,
    rendered_tiles: &Query<&RenderedTile>,
    features: &Query<&FeatureId, With<VectorTileFeatureMarker>>,
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

pub fn activate_all_renderable_features(
    tc: &TileCacheManager,
    handle: &TileHandle,
    rendered_tiles: &Query<&RenderedTile>,
    features: &Query<&FeatureId, With<VectorTileFeatureMarker>>,
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
                if let Ok(mut r) = renderable_features.get_mut(id) {
                    r.activate(active);
                };
            }
        });
}

pub fn are_all_renderable_features_active(
    tc: &TileCacheManager,
    handle: &TileHandle,
    rendered_tiles: &Query<&RenderedTile>,
    features: &Query<&FeatureId, With<VectorTileFeatureMarker>>,
    renderable_features: &mut Query<&mut RenderableFeature>,
) -> Option<bool> {
    get_renderable_feature_activation_state(
        tc,
        handle,
        rendered_tiles,
        features,
        renderable_features,
    )
    .map(|state| state.all_active)
}

#[derive(Clone, Copy)]
struct RenderableFeatureActivationState {
    all_active: bool,
    any_active: bool,
}

fn get_renderable_feature_activation_state(
    tc: &TileCacheManager,
    handle: &TileHandle,
    rendered_tiles: &Query<&RenderedTile>,
    features: &Query<&FeatureId, With<MVTFeatureMarker>>,
    renderable_features: &mut Query<&mut RenderableFeature>,
) -> Option<RenderableFeatureActivationState> {
    let rendered_tile_entity = tc.rendered_tile_caches.get(handle)?;
    let rendered_tile = rendered_tiles.get(*rendered_tile_entity).ok()?;
    let tile_feature_ids = rendered_tile.feature_ids.as_ref()?;

    let mut all_active = true;
    let mut any_active = false;

    for feature_id in tile_feature_ids {
        let feature = features.get(*feature_id).ok()?;
        let renderable_feature = renderable_features.get(feature.0?).ok()?;
        let active = renderable_feature.is_active();
        all_active = all_active && active;
        any_active = any_active || active;
        if any_active && !all_active {
            break;
        }
    }

    Some(RenderableFeatureActivationState {
        all_active,
        any_active,
    })
}

pub fn are_all_features_rendered(renderable_features: Option<Vec<&RenderableFeature>>) -> bool {
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

fn begin_traverse_tile(
    ellipsoid: &Ellipsoid<FloatType>,
    occluder: &EllipsoidalOccluder,
    _camera: &Transform,
    tile: &mut VectorTile,
    terrain_into: Option<&TerrainInformation>,
) {
    tile.set_max_height(terrain_into.map(|t| t.max_height).unwrap_or(0.));
    tile.set_min_height(terrain_into.map(|t| t.min_height).unwrap_or(0.));
    tile.update_tile_occludee_point(ellipsoid, occluder);
}

pub enum TraversalResult {
    TileRendered,
    ChildrenRendered,
    ChildrenMeshPrepared,
    Culled,
    NotFound,
    Failed,
    Overscaled,
}
