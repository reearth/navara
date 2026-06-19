use bevy_ecs::prelude::*;
use navara_buffer_store::BufferStore;
use navara_component::{Deleted, Order, OrderByDistance, Priority};
use navara_core::{Ellipsoid, TilingScheme};
use navara_data_requester::DataManager;

use navara_fog::Fog;
use navara_frame::FrameManager;
use navara_math::{FloatType, Transform};

use navara_mesh::Mesh;
use navara_occluder::ellipsoidal_occluder::EllipsoidalOccluder;

use navara_camera::CameraFrustum;
use navara_tile_component::{
    QuantizedMeshData, RasterDEMData, TerrainTile, TerrainTileQuadtree, Tile, TileHandle,
    TileMeshMarker, TileTerrainDataRequesterQuery, TileTextureFragmentQuery,
};
use navara_window::Window;

use crate::data_requester::request_terrain_data;
use crate::texture_fragment::request_texture_fragment;

use super::{
    render::RenderedTile,
    tile_cache_manager::{LayerParent, RenderedTileCache, TileCacheManager},
};

use navara_layer::{TerrainDataType, TerrainLayer, TilesLayer};

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
    tiles: &Query<(&TilesLayer, &Order)>,
    terrain_layer: &Option<&TerrainLayer>,
    handle: TileHandle,
    tc: &mut TileCacheManager,
    qt: &mut TerrainTileQuadtree,
    buf: &mut BufferStore,
    data_manager: &mut DataManager,
    frame: &FrameManager,
    camera: &Transform,
    frustum: &CameraFrustum,
    texture_fragment: &TileTextureFragmentQuery,
    data_requesters: &Query<&navara_data_requester::DataRequester>,
    terrain_data_requester: &TileTerrainDataRequesterQuery,
    window: &Window,
    ellipsoid: &Ellipsoid<FloatType>,
    occluder: &EllipsoidalOccluder,
    meshes: &mut Query<&mut Mesh, (With<TileMeshMarker>, Without<Deleted>)>,
    fog: &Fog,
    max_sse: f64,
    is_ancestor_rendered: bool,
    // This is used to keep rendering current children when parent tile isn't ready after you zoomed out.
    meets_sse_ancestors: bool,
    // This is used to show parent's texture if child's texture isn't ready.
    ready_parent_tile_handle: Option<TileHandle>,
    // This tracks the nearest ready hillshade parent for each layer.
    ready_layer_parents: Option<Vec<Option<LayerParent>>>,
) -> TraversalResult {
    let has_regular_tiles = tiles.iter().any(|(t, _)| t.hillshade_config.is_none());

    match qt.qt.get(handle) {
        Some(tile) => {
            let tile_overmax = has_regular_tiles
                && tiles
                    .iter()
                    .filter(|(t, _)| t.hillshade_config.is_none())
                    .all(|(t, _)| t.is_over_max_zoom(tile.coords.z));

            // Hillshade layers: allow overscaling - stop at overscaled_max_zoom
            let has_hillshade_tiles = tiles.iter().any(|(t, _)| t.hillshade_config.is_some());
            let hillshade_overmax = has_hillshade_tiles
                && tiles
                    .iter()
                    .filter(|(t, _)| t.hillshade_config.is_some())
                    .all(|(t, _)| t.is_over_overscaled_max_zoom(tile.coords.z));

            // Terrain: allow upsampling - stop at overscaled_max_zoom
            let terrain_overmax = terrain_layer.is_some()
                && terrain_layer
                    .unwrap()
                    .is_over_overscaled_max_zoom(tile.coords.z);

            // Only stop if ALL active sources are beyond their limits
            if (!has_regular_tiles || tile_overmax)
                && (!has_hillshade_tiles || hillshade_overmax)
                && (terrain_layer.is_none() || terrain_overmax)
            {
                return TraversalResult::NotFound;
            }
        }
        None => unreachable!(),
    };

    match qt.qt.get_mut(handle) {
        Some(tile) => begine_traverse_tile(ellipsoid, occluder, camera, frame, tile),
        None => unreachable!(),
    };

    let tile = match qt.qt.get(handle) {
        Some(tile) => tile,
        None => unreachable!(),
    };

    let is_culled_by_occlusion = !tile
        .occludee_point_in_scaled_space
        .map(|p| occluder.is_scaled_space_point_visible(p))
        .unwrap_or(true);
    if is_culled_by_occlusion {
        return TraversalResult::Culled;
    }

    let is_culled_by_frustum = !tile.intersect_with_camera_frustum(frustum);

    let tile_ready_state = tile.is_ready(
        qt,
        texture_fragment,
        data_requesters,
        terrain_data_requester,
        terrain_layer,
        tiles,
    );
    let is_tile_ready = tile_ready_state.is_tile_ready;
    let use_terrain = tile_ready_state.use_terrain;

    let is_activated = tc.is_rendered_tile_activated(&handle, meshes);
    let is_rendered_last_frame = is_activated;

    let distance_from_camera = tile.calc_distance_from_camera(camera, ellipsoid).abs();
    let sse = tile.calc_sse(
        frustum,
        window,
        ellipsoid,
        if terrain_layer.is_some() { 65. } else { 64. },
        distance_from_camera,
        fog,
    );

    let tile = qt.qt.get_mut(handle).unwrap();
    tile.sse = sse;
    tile.distance_from_camera = distance_from_camera;

    let were_children_rendered = tile.were_children_rendered;
    tile.were_children_rendered = false;

    let is_over_min_z = if has_regular_tiles {
        tiles
            .iter()
            .filter(|(t, _)| t.hillshade_config.is_none())
            .any(|(t, _)| t.is_over_min_zoom(tile.coords.z))
    } else {
        true
    };

    let meets_sse = sse <= max_sse && is_over_min_z;

    let is_renderable = is_rendered_last_frame || is_tile_ready;

    // If this tile has a terrain and it's prepared, request a texture for this tile.
    // It means terrain is rendered first, then the texture is prepared lazily.
    if terrain_layer.is_some() && is_renderable {
        let tile = qt.qt.get_mut(handle).unwrap();
        request_texture_fragment(
            command,
            tile,
            tiles,
            handle,
            texture_fragment,
            data_requesters,
            Priority::High,
            buf,
            data_manager,
        );
    }

    // This should not create the unnecessary terrain data, since `is_upsamplable` becomes `true`
    // only when the parent tile has been rendered.
    if tile_ready_state.is_upsamplable {
        prepare_upsamplable_terrain_data(qt, terrain_layer, handle);
    }

    if meets_sse || meets_sse_ancestors {
        if !meets_sse_ancestors {
            prepare_tile_resource(
                command,
                qt,
                buf,
                data_manager,
                terrain_layer,
                handle,
                tc,
                tiles,
                texture_fragment,
                data_requesters,
                terrain_data_requester,
                if is_renderable {
                    Priority::Medium
                } else {
                    Priority::High
                },
            );
        }

        if is_renderable
            // Keep rendering children while preparing the tile if it's available, because rendering tile takes some time.
            && !were_children_rendered
        {
            return TraversalResult::TileRendered;
        }

        if !were_children_rendered {
            return TraversalResult::NotFound;
        }
    }

    // Culled tiles do not traverse children, but they are rendered to prevent parent tiles from flickering.
    if !is_culled_by_frustum && let Some(children) = TerrainTile::traversable_children(qt, handle) {
        let mut any_children_rendered = false;

        let ready_parent_tile_handle = if tile_ready_state.is_texture_ready {
            Some(handle)
        } else {
            ready_parent_tile_handle
        };

        // Update hillshade parents - track nearest ready parent for each layer
        let ready_layer_parents = update_ready_layer_parents(
            qt,
            handle,
            tiles,
            texture_fragment,
            data_requesters,
            ready_layer_parents,
        );

        // Tile has several states to switch LOD smoothly.
        // 1. RenderedTile component is spawned if a tile is selected.
        // 2. Rendering engine needs to do some preparations, so the selected tile is marked as it's prepared after these preparations.
        // 3. The selected tile is activated if all other same level children are activated as well.
        // 4. When the selected tile is activated, the tile will be visible.
        let mut are_all_children_rendered = true;
        let mut are_all_children_prepared = true;
        let mut are_all_children_activated = true;

        let mut rendered_children_indices = vec![];
        let mut activated_children_indices = vec![];
        let mut hidden_children_indices = vec![];
        for (i, child) in children.iter().enumerate() {
            let traversal_result = traverse_tile(
                command,
                tiles,
                terrain_layer,
                *child,
                tc,
                qt,
                buf,
                data_manager,
                frame,
                camera,
                frustum,
                texture_fragment,
                data_requesters,
                terrain_data_requester,
                window,
                ellipsoid,
                occluder,
                meshes,
                fog,
                max_sse,
                if meets_sse_ancestors {
                    is_ancestor_rendered
                } else {
                    is_rendered_last_frame
                },
                meets_sse,
                ready_parent_tile_handle,
                ready_layer_parents.clone(),
            );

            if matches!(traversal_result, TraversalResult::NotFound) {
                are_all_children_rendered = false;
                are_all_children_prepared = false;
                are_all_children_activated = false;
            }

            if matches!(
                traversal_result,
                TraversalResult::NotFound | TraversalResult::Culled
            ) {
                hidden_children_indices.push(i);
            }

            // If there is one child at least, trigger the rendering children process.
            if matches!(
                traversal_result,
                TraversalResult::TileRendered
                    | TraversalResult::ChildrenRendered
                    | TraversalResult::ChildrenMeshesPrepared
                    | TraversalResult::Culled
            ) {
                any_children_rendered = true;
            }

            // If tile's mesh isn't ready, render the parent tile.
            if (matches!(traversal_result, TraversalResult::TileRendered)
                && !tc.is_rendered_tile_prepared(child))
            {
                are_all_children_prepared = false;
                are_all_children_rendered = false;
            }

            // If tile's mesh isn't ready, render the parent tile.
            if (matches!(traversal_result, TraversalResult::TileRendered)
                && !tc.is_rendered_tile_activated(child, meshes))
            {
                are_all_children_activated = false;
            }

            // Skip rendering children in this tile.
            if matches!(
                traversal_result,
                TraversalResult::ChildrenRendered | TraversalResult::ChildrenMeshesPrepared
            ) {
                rendered_children_indices.push(i);
            }

            if matches!(traversal_result, TraversalResult::ChildrenMeshesPrepared) {
                activated_children_indices.push(i);
            }
        }

        // Avoid rendering children if children were rendered at last frame.
        let allow_updating_state_of_children = !meets_sse && !meets_sse_ancestors;

        if any_children_rendered {
            // If the children are rendered to fill the parent, the parent tile replaces them when it is ready.
            let hide_children = (meets_sse_ancestors && is_ancestor_rendered)
                || (meets_sse && is_rendered_last_frame);

            let tile = qt.qt.get_mut(handle).unwrap();
            tile.were_children_rendered = are_all_children_activated && !hide_children;
            // Defer spawning children until this tile's mesh is ready so each
            // level can upsample from a parent that already has a built mesh.
            // Children's data requests are already issued via
            // prepare_tile_resource and act as preload while waiting.
            let parent_mesh_ready = tile.cached_mesh_handle.is_some();

            if allow_updating_state_of_children && (!use_terrain || parent_mesh_ready) {
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
                    spawn_tile_entity(
                        command,
                        tc,
                        frame,
                        tile,
                        handle,
                        ready_parent_tile_handle,
                        ready_layer_parents.clone(),
                    );
                }
            }

            for (i, child) in children.iter().enumerate() {
                if activated_children_indices.contains(&i) || hidden_children_indices.contains(&i) {
                    // Hide parent tile when children are activated.
                    tc.activate_rendered_tile(child, meshes, false);
                    continue;
                }

                // Activate child tile when children are activated.
                tc.activate_rendered_tile(
                    child,
                    meshes,
                    are_all_children_prepared && !hide_children,
                );
            }

            if allow_updating_state_of_children {
                if are_all_children_prepared {
                    return TraversalResult::ChildrenMeshesPrepared;
                }

                if are_all_children_rendered {
                    // This tile's children are rendered completely, so parent tile isn't rendered.
                    return TraversalResult::ChildrenRendered;
                }
            }
        }
    }

    if !is_renderable {
        // Avoid to request or render new tile while waiting for parent tile is activated.
        if meets_sse_ancestors {
            return TraversalResult::NotFound;
        }
        if is_over_min_z {
            prepare_tile_resource(
                command,
                qt,
                buf,
                data_manager,
                terrain_layer,
                handle,
                tc,
                tiles,
                texture_fragment,
                data_requesters,
                terrain_data_requester,
                Priority::Extreme,
            );
        }
        return TraversalResult::NotFound;
    }

    // Avoid to return an inactivated tile when meets SSE from ancestors.
    if meets_sse_ancestors && !is_activated {
        return TraversalResult::NotFound;
    }

    TraversalResult::TileRendered
}

// We should use entity to store the rendered tile, because the Bevy's entity is extensible.
pub fn spawn_tile_entity(
    commands: &mut Commands,
    tc: &mut TileCacheManager,
    frame: &FrameManager,
    tile: &mut TerrainTile,
    tile_handle: TileHandle,
    ready_parent_tile_handle: Option<TileHandle>,
    layer_parents: Option<Vec<Option<LayerParent>>>,
) {
    tile.rendered_at = frame.rendered_frame();
    tc.is_updated_in_this_frame = true;

    if let Some(tile) = tc.rendered_tile_caches.get_mut(&tile_handle) {
        tile.ready_parent_tile_handle = ready_parent_tile_handle;
        tile.layer_parents = layer_parents;
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
    tc.rendered_tile_caches.insert(
        tile_handle,
        RenderedTileCache {
            rendered_tile_entity: e.id(),
            ready_parent_tile_handle,
            layer_parents,
            mesh_entity: None,
            mesh_prepared: false,
            needs_material_update: true,
        },
    );
}

/// Update per-layer parents by tracking the nearest ready ancestor entity for each layer.
/// Works uniformly for regular texture layers and hillshade layers: for each layer,
/// the appropriate entity slot (texture_fragment_entity_ids vs hillshade_entity_ids) is
/// consulted, and if it is ready it becomes the parent for the layer's descendants.
fn update_ready_layer_parents(
    qt: &TerrainTileQuadtree,
    handle: TileHandle,
    tiles: &Query<(&TilesLayer, &Order)>,
    texture_fragment: &TileTextureFragmentQuery,
    data_requesters: &Query<&navara_data_requester::DataRequester>,
    ready_layer_parents: Option<Vec<Option<LayerParent>>>,
) -> Option<Vec<Option<LayerParent>>> {
    let tile = qt.qt.get(handle)?;
    let mut updated_parents = Vec::new();

    for (i, (layer, _)) in tiles.iter().sort::<&Order>().enumerate() {
        let own_entity = if layer.hillshade_config.is_some() {
            tile.hillshade_entity_ids
                .as_ref()
                .and_then(|ids| ids.get(i).copied().flatten())
        } else {
            tile.texture_fragment_entity_ids
                .as_ref()
                .and_then(|ids| ids.get(i).copied().flatten())
        };

        let parent = if let Some(entity) = own_entity
            && TerrainTile::is_texture_entity_ready(entity, texture_fragment, data_requesters)
        {
            Some(LayerParent {
                entity,
                zoom: tile.coords.z,
            })
        } else {
            ready_layer_parents
                .as_ref()
                .and_then(|parents| parents.get(i).cloned())
                .flatten()
        };
        updated_parents.push(parent);
    }

    Some(updated_parents)
}

/// Prepare some resource that is necessary to render the tile.
/// This returns whether the resource is requested or not.
#[allow(clippy::too_many_arguments)]
pub fn prepare_tile_resource(
    commands: &mut Commands,
    qt: &mut TerrainTileQuadtree,
    buf: &mut BufferStore,
    data_manager: &mut DataManager,
    terrain_layer: &Option<&TerrainLayer>,
    handle: TileHandle,
    tc: &mut TileCacheManager,
    tiles: &Query<(&TilesLayer, &Order)>,
    texture_fragment: &TileTextureFragmentQuery,
    data_requesters: &Query<&navara_data_requester::DataRequester>,
    terrain_data_requester: &TileTerrainDataRequesterQuery,
    priority: Priority,
) {
    let tile = qt.qt.get_mut(handle).unwrap();

    let should_upsample = terrain_layer.is_some_and(|l| l.should_upsample(tile.coords.z));
    if should_upsample {
        return;
    }

    if matches!(terrain_layer, Some(l) if l.is_over_min_zoom(tile.coords.z)) {
        request_terrain_data(
            commands,
            tile,
            buf,
            data_manager,
            terrain_layer,
            handle,
            terrain_data_requester,
            priority,
        );
    } else {
        // If this tile doesn't have terrain, request just a texture.
        request_texture_fragment(
            commands,
            tile,
            tiles,
            handle,
            texture_fragment,
            data_requesters,
            Priority::High,
            buf,
            data_manager,
        );
    }

    if !tc.requested_tile_caches.contains(&handle) {
        tc.requested_tile_caches.insert(handle);
    }
}

fn prepare_upsamplable_terrain_data(
    qt: &mut TerrainTileQuadtree,
    terrain_layer: &Option<&TerrainLayer>,
    handle: TileHandle,
) {
    if qt.qt.get(handle).is_some_and(|t| t.terrain_data.is_some()) {
        return;
    }

    let Some(layer) = terrain_layer else {
        return;
    };

    let terrain_data: Box<dyn navara_tile_component::TerrainData> = match &layer.terrain_type {
        TerrainDataType::RasterDEM => {
            let Some(elevation_decoder) = layer
                .appearance
                .as_ref()
                .and_then(|a| a.elevation_decoder())
            else {
                return;
            };
            Box::new(RasterDEMData::new(*elevation_decoder))
        }
        TerrainDataType::QuantizedMesh => {
            let scheme = layer
                .appearance
                .as_ref()
                .map_or_else(TilingScheme::default, |a| a.tiling_scheme());
            Box::new(QuantizedMeshData::new_with_tiling_scheme(scheme))
        }
        TerrainDataType::Ellipsoid | TerrainDataType::Unknown => unreachable!(),
    };

    let tile = qt.qt.get_mut(handle).unwrap();

    tile.terrain_data = Some(terrain_data);
}

fn begine_traverse_tile(
    ellipsoid: &Ellipsoid<FloatType>,
    occluder: &EllipsoidalOccluder,
    _camera: &Transform,
    frame: &FrameManager,
    tile: &mut TerrainTile,
) {
    tile.visited_at = frame.rendered_frame();
    tile.update_tile_occludee_point(ellipsoid, occluder);
}

pub(super) enum TraversalResult {
    TileRendered,
    ChildrenRendered,
    ChildrenMeshesPrepared,
    Culled,
    NotFound,
}
