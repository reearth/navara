use std::sync::Arc;

use bevy_ecs::prelude::*;
use navara_buffer_store::BufferStore;
use navara_component::{Deleted, Order, OrderByDistance, Priority};
use navara_core::Ellipsoid;
use navara_data_requester::DataManager;

use navara_fog::{DynamicSseTerm, Fog};
use navara_frame::FrameManager;
use navara_math::{FloatType, Transform};
use navara_memory::SseDegrade;

use navara_mesh::Mesh;
use navara_occluder::ellipsoidal_occluder::EllipsoidalOccluder;

use navara_camera::CameraFrustum;
use navara_tile_component::{
    QuantizedMeshData, RasterDEMData, TerrainTile, TerrainTileQuadtree, Tile, TileHandle,
    TileMeshMarker, TileTerrainDataRequesterQuery,
};
use navara_window::Window;

use crate::data_requester::request_terrain_data;
use crate::texture_fragment::request_hillshade_data_requester;

use super::{
    render::RenderedTile,
    tile_cache_manager::{LayerParent, RenderedTileCache, TileCacheManager},
};

use navara_layer::{TerrainDataType, TerrainLayer, TilesLayer};
use navara_source::SourceStore;

// This process works in the following steps.
// 1. Check if the AABB of the tile is within the camera's frustum.(Frustum culling)
// 2. Check horizon culling because the frustum culling isn't enough.
// 3. Check SSE is within max SSE.
// 4. If SSE works and the tile is ready, the tile should be rendered.
// 5. On the other hand, if SSE works but the tile isn't loaded, the tile should be requested, not rendered.
// 6. If above steps aren't matched, traverse children.
// 7. If children couldn't be rendered completely, use this tile instead.
#[allow(clippy::too_many_arguments)]
pub fn traverse_terrain(
    command: &mut Commands,
    // The layer list sorted by `Order`, collected once per system run — this
    // function runs per traversed tile, so it must not sort per call.
    sorted_layers: &[(&TilesLayer, &Order)],
    terrain_layer: &Option<&TerrainLayer>,
    source_store: &SourceStore,
    handle: TileHandle,
    tc: &mut TileCacheManager,
    qt: &mut TerrainTileQuadtree,
    buf: &mut BufferStore,
    data_manager: &mut DataManager,
    frame: &FrameManager,
    camera: &Transform,
    frustum: &CameraFrustum,
    data_requesters: &Query<&navara_data_requester::DataRequester>,
    terrain_data_requester: &TileTerrainDataRequesterQuery,
    window: &Window,
    ellipsoid: &Ellipsoid<FloatType>,
    occluder: &EllipsoidalOccluder,
    meshes: &mut Query<&mut Mesh, (With<TileMeshMarker>, Without<Deleted>)>,
    fog: &Fog,
    dynamic_sse: DynamicSseTerm,
    max_sse: f64,
    degrade: SseDegrade,
    is_ancestor_rendered: bool,
    // This is used to keep rendering current children when parent tile isn't ready after you zoomed out.
    meets_sse_ancestors: bool,
    // This is used to show parent's texture if child's texture isn't ready.
    ready_parent_tile_handle: Option<TileHandle>,
    // This tracks the nearest ready hillshade parent for each layer.
    // Shared (Arc) because every child of every visited tile receives a copy.
    ready_layer_parents: Option<Arc<Vec<Option<LayerParent>>>>,
) -> TraversalResult {
    let has_regular_tiles = sorted_layers
        .iter()
        .any(|(t, _)| t.hillshade_config.is_none());

    match qt.qt.get(handle) {
        Some(tile) => {
            let tile_overmax = has_regular_tiles
                && sorted_layers
                    .iter()
                    .filter(|(t, _)| t.hillshade_config.is_none())
                    .filter_map(|(t, _)| t.source_id.as_deref().and_then(|id| source_store.get(id)))
                    .all(|s| s.is_over_max_zoom(tile.coords.z));

            // Hillshade layers: allow overscaling - stop at overscaled_max_zoom
            let has_hillshade_tiles = sorted_layers
                .iter()
                .any(|(t, _)| t.hillshade_config.is_some());
            let hillshade_overmax = has_hillshade_tiles
                && sorted_layers
                    .iter()
                    .filter(|(t, _)| t.hillshade_config.is_some())
                    .filter_map(|(t, _)| t.source_id.as_deref().and_then(|id| source_store.get(id)))
                    .all(|s| s.is_over_overscaled_max_zoom(tile.coords.z));

            // Terrain: allow upsampling - stop at overscaled_max_zoom
            let terrain_overmax = terrain_layer
                .and_then(|l| l.source_id.as_deref())
                .and_then(|id| source_store.get(id))
                .is_some_and(|s| s.is_over_overscaled_max_zoom(tile.coords.z));

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
        Some(tile) => begin_traverse_terrain(ellipsoid, occluder, camera, frame, tile),
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
        data_requesters,
        terrain_data_requester,
        terrain_layer,
        sorted_layers,
        source_store,
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
        dynamic_sse,
    );

    let tile = qt.qt.get_mut(handle).unwrap();
    tile.sse = sse;
    tile.distance_from_camera = distance_from_camera;

    let were_children_rendered = tile.were_children_rendered;
    tile.were_children_rendered = false;

    let is_over_min_z = if has_regular_tiles {
        sorted_layers
            .iter()
            .filter(|(t, _)| t.hillshade_config.is_none())
            .filter_map(|(t, _)| t.source_id.as_deref().and_then(|id| source_store.get(id)))
            .any(|s| s.is_over_min_zoom(tile.coords.z))
    } else {
        true
    };

    let meets_sse =
        sse <= degrade.effective_max_sse(max_sse, distance_from_camera) && is_over_min_z;

    let is_renderable = is_rendered_last_frame || is_tile_ready;

    // If this tile has a terrain and it's prepared, request its hillshade
    // textures lazily. Regular raster textures are draped from the raster
    // pipeline (see `update_mesh_material`).
    // Frustum-culled tiles are still requested (they backfill the parent and
    // prevent flickering) but one priority step lower, so in-view tiles win
    // the pending-request slots and bandwidth.
    let demote_if_culled = |p: Priority| if is_culled_by_frustum { p.demote() } else { p };

    if terrain_layer.is_some() && is_renderable {
        let tile = qt.qt.get_mut(handle).unwrap();
        request_hillshade_data_requester(
            command,
            tile,
            sorted_layers,
            source_store,
            handle,
            data_requesters,
            demote_if_culled(Priority::High),
            buf,
            data_manager,
        );
    }

    // This should not create the unnecessary terrain data, since `is_upsamplable` becomes `true`
    // only when the parent tile has been rendered.
    if tile_ready_state.is_upsamplable {
        prepare_upsamplable_terrain_data(qt, terrain_layer, source_store, handle);
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
                sorted_layers,
                source_store,
                data_requesters,
                terrain_data_requester,
                demote_if_culled(if is_renderable {
                    Priority::Medium
                } else {
                    Priority::High
                }),
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
            sorted_layers,
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
            let traversal_result = traverse_terrain(
                command,
                sorted_layers,
                terrain_layer,
                source_store,
                *child,
                tc,
                qt,
                buf,
                data_manager,
                frame,
                camera,
                frustum,
                data_requesters,
                terrain_data_requester,
                window,
                ellipsoid,
                occluder,
                meshes,
                fog,
                dynamic_sse,
                max_sse,
                degrade,
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
            let parent_mesh_ready = tile.cached_mesh_handle.is_some();

            if allow_updating_state_of_children {
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

                    // A child with its own ready DEM builds its mesh from its
                    // own data, so it doesn't wait for this tile's mesh. Until
                    // this tile's mesh is built, hold back only children
                    // without ready DEM: a terrain-failed child would render
                    // an unexpected flat last-resort mesh (#601), while once
                    // the mesh exists it upsamples instead. Their data
                    // requests were already issued via prepare_tile_resource
                    // and act as preload while waiting.
                    if use_terrain
                        && !parent_mesh_ready
                        && !tc.rendered_tile_caches.contains_key(&handle)
                        && !qt
                            .qt
                            .get(handle)
                            .is_some_and(|t| t.is_terrain_ready(terrain_data_requester))
                    {
                        continue;
                    }

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
                sorted_layers,
                source_store,
                data_requesters,
                terrain_data_requester,
                demote_if_culled(Priority::Extreme),
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
    layer_parents: Option<Arc<Vec<Option<LayerParent>>>>,
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

/// Update the per-layer hillshade ancestor fallback by tracking the nearest
/// ready hillshade entity for each layer. Regular raster layers are resolved by
/// the raster pull (see `update_mesh_material`) and keep a `None` slot here, so
/// only hillshade layers carry a terrain-side parent.
fn update_ready_layer_parents(
    qt: &TerrainTileQuadtree,
    handle: TileHandle,
    sorted_layers: &[(&TilesLayer, &Order)],
    data_requesters: &Query<&navara_data_requester::DataRequester>,
    ready_layer_parents: Option<Arc<Vec<Option<LayerParent>>>>,
) -> Option<Arc<Vec<Option<LayerParent>>>> {
    let tile = qt.qt.get(handle)?;
    let mut updated_parents = Vec::with_capacity(sorted_layers.len());

    for (i, (layer, _)) in sorted_layers.iter().enumerate() {
        // Regular raster layers are draped via the raster pull, not the
        // terrain-side ancestor fallback, so they keep an empty slot here.
        if layer.hillshade_config.is_none() {
            updated_parents.push(None);
            continue;
        }

        let own_entity = tile
            .hillshade_entity_ids
            .as_ref()
            .and_then(|ids| ids.get(i).copied().flatten());

        let parent = if let Some(entity) = own_entity
            && TerrainTile::is_hillshade_entity_ready(entity, data_requesters)
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

    Some(Arc::new(updated_parents))
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
    sorted_layers: &[(&TilesLayer, &Order)],
    source_store: &SourceStore,
    data_requesters: &Query<&navara_data_requester::DataRequester>,
    terrain_data_requester: &TileTerrainDataRequesterQuery,
    priority: Priority,
) {
    let tile = qt.qt.get_mut(handle).unwrap();

    let terrain_source = terrain_layer
        .and_then(|l| l.source_id.as_deref())
        .and_then(|id| source_store.get(id));

    let should_upsample = terrain_source.is_some_and(|s| s.should_overscale(tile.coords.z));
    if should_upsample {
        return;
    }

    if matches!(terrain_source, Some(s) if s.is_over_min_zoom(tile.coords.z)) {
        request_terrain_data(
            commands,
            tile,
            buf,
            data_manager,
            terrain_layer,
            source_store,
            handle,
            terrain_data_requester,
            priority,
        );
    } else {
        // If this tile doesn't have terrain, request its hillshade textures.
        // Regular raster textures are draped from the raster pipeline.
        request_hillshade_data_requester(
            commands,
            tile,
            sorted_layers,
            source_store,
            handle,
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
    source_store: &SourceStore,
    handle: TileHandle,
) {
    if qt.qt.get(handle).is_some_and(|t| t.terrain_data.is_some()) {
        return;
    }

    let Some(layer) = terrain_layer else {
        return;
    };
    let Some(source) = layer
        .source_id
        .as_deref()
        .and_then(|id| source_store.get(id))
    else {
        return;
    };

    let terrain_data: Box<dyn navara_tile_component::TerrainData> = match &layer.terrain_type {
        TerrainDataType::RasterDEM => {
            let Some(elevation_decoder) = source.elevation_decoder() else {
                return;
            };
            Box::new(RasterDEMData::new(*elevation_decoder))
        }
        TerrainDataType::QuantizedMesh => Box::new(QuantizedMeshData::new_with_tiling_scheme(
            source.tiling_scheme(),
        )),
        TerrainDataType::Ellipsoid | TerrainDataType::Unknown => unreachable!(),
    };

    let tile = qt.qt.get_mut(handle).unwrap();

    tile.terrain_data = Some(terrain_data);
}

fn begin_traverse_terrain(
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

#[cfg(test)]
mod tests {
    use super::*;

    use bevy_app::{App, Update};

    use navara_core::{Aabb, Angle, TileXYZ, WGS84_64, WGS84_A_64};
    use navara_material::{Appearance, RasterMaterial};
    use navara_math::Vec3;

    /// Camera placed at twice the Earth radius above (lng 0, lat 0), looking at
    /// the globe centre. The horizon half-angle is `acos(R / 2R) = 60°`, so any
    /// tile centred more than ~60° away in longitude/latitude is occluded.
    fn test_camera() -> (Transform, CameraFrustum, EllipsoidalOccluder) {
        let camera_ecef = Vec3::new(WGS84_A_64 * 2.0, 0.0, 0.0);
        let camera = Transform::from_translation(camera_ecef).looking_at(Vec3::ZERO, Vec3::Y);
        let frustum = CameraFrustum::new(&camera, 0.1, 1e9, Angle::new(60.0).rad().val(), 1.0, 1.0);
        let occluder = EllipsoidalOccluder::new(&camera_ecef, WGS84_64);
        (camera, frustum, occluder)
    }

    // ----- begin_traverse_terrain --------------------------------------------

    #[test]
    fn begin_traverse_terrain_stamps_visit_and_computes_occludee() {
        let (camera, _frustum, occluder) = test_camera();
        let frame = FrameManager::default(); // rendered_frame() == 0

        // A small tile near (lng 0, lat 0) so the occludee point is well defined.
        let mut tile = TerrainTile::new(TileXYZ { x: 8, y: 8, z: 4 }, 0., 0.);
        tile.visited_at = 42; // sentinel that must be overwritten
        assert!(tile.occludee_point_in_scaled_space.is_none());

        begin_traverse_terrain(&WGS84_64, &occluder, &camera, &frame, &mut tile);

        // The visit frame is recorded (here 0, overwriting the sentinel)...
        assert_eq!(tile.visited_at, frame.rendered_frame());
        assert_ne!(tile.visited_at, 42);
        // ...and the horizon-culling point is computed.
        assert!(tile.occludee_point_in_scaled_space.is_some());
    }

    // ----- traverse_terrain ---------------------------------------------------

    #[derive(bevy_ecs::prelude::Resource)]
    struct TargetHandle(TileHandle);

    #[derive(bevy_ecs::prelude::Resource)]
    struct TraverseConfig {
        max_sse: f64,
    }

    #[derive(bevy_ecs::prelude::Resource, Default)]
    struct LastResult(String);

    fn result_label(r: &TraversalResult) -> &'static str {
        match r {
            TraversalResult::TileRendered => "rendered",
            TraversalResult::ChildrenRendered => "children_rendered",
            TraversalResult::ChildrenMeshesPrepared => "children_prepared",
            TraversalResult::Culled => "culled",
            TraversalResult::NotFound => "notfound",
        }
    }

    /// Drive `traverse_terrain` from a Bevy system so its `Commands`/`Query`
    /// system-params are supplied. No terrain layer is present, so a fresh tile is
    /// "ready" (renders as flat geometry) — this keeps the readiness deterministic
    /// without standing up the async mesh-construction worker.
    #[allow(clippy::too_many_arguments)]
    fn run_terrain_traverse(
        mut commands: Commands,
        tiles: Query<(&TilesLayer, &Order)>,
        mut qt: ResMut<TerrainTileQuadtree>,
        mut tc: ResMut<TileCacheManager>,
        mut buf: ResMut<BufferStore>,
        mut data_manager: ResMut<DataManager>,
        frame: Res<FrameManager>,
        window: Res<Window>,
        data_requesters: Query<&navara_data_requester::DataRequester>,
        terrain_data_requester: TileTerrainDataRequesterQuery,
        mut meshes: Query<&mut Mesh, (With<TileMeshMarker>, Without<Deleted>)>,
        target: Res<TargetHandle>,
        config: Res<TraverseConfig>,
        source_store: Res<SourceStore>,
        mut out: ResMut<LastResult>,
    ) {
        let (camera, frustum, occluder) = test_camera();
        let fog = Fog {
            enabled: false,
            density: 0.,
            sse_factor: 1.0,
        };
        let terrain_layer: Option<&TerrainLayer> = None;

        let sorted_layers: Vec<_> = tiles.iter().sort::<&Order>().collect();
        let result = traverse_terrain(
            &mut commands,
            &sorted_layers,
            &terrain_layer,
            &source_store,
            target.0,
            &mut tc,
            &mut qt,
            &mut buf,
            &mut data_manager,
            &frame,
            &camera,
            &frustum,
            &data_requesters,
            &terrain_data_requester,
            &window,
            &WGS84_64,
            &occluder,
            &mut meshes,
            &fog,
            DynamicSseTerm::NONE,
            config.max_sse,
            SseDegrade::NONE,
            false,
            false,
            None,
            None,
        );
        out.0 = result_label(&result).to_string();

        // Mirror the relevant arms of `update_terrain`'s root handling so a test
        // can observe the parent being shown (TileRendered) or hidden once its
        // children take over (ChildrenMeshesPrepared). For tiles without a seeded
        // render cache these calls are no-ops.
        match &result {
            TraversalResult::TileRendered => {
                if tc.is_rendered_tile_prepared(&target.0) {
                    tc.activate_rendered_tile(&target.0, &mut meshes, true);
                }
            }
            TraversalResult::ChildrenMeshesPrepared => {
                tc.activate_rendered_tile(&target.0, &mut meshes, false);
            }
            _ => {}
        }
    }

    /// A regular (non-hillshade) raster layer with the given zoom range, paired
    /// with the source carrying that zoom range (zoom lives on the source now).
    fn raster_layer(
        layer_id: &str,
        min_zoom: usize,
        max_zoom: usize,
    ) -> (TilesLayer, navara_source::Source) {
        let layer = TilesLayer {
            layer_id: layer_id.to_string(),
            source_id: Some(layer_id.to_string()),
            appearance: Some(Appearance::TerrainTile(RasterMaterial::default())),
            elevation_heatmap_config: None,
            hillshade_config: None,
        };
        let source = navara_source::Source::RasterTile(navara_source::RasterTileSource {
            source_id: layer_id.to_string(),
            url: "https://example.com/{z}/{x}/{y}.png".to_string(),
            tms: false,
            min_zoom,
            max_zoom,
            overscaled_max_zoom: max_zoom,
        });
        (layer, source)
    }

    /// Register the layer's source in the store and spawn the layer entity.
    fn spawn_layer(app: &mut App, layer: (TilesLayer, navara_source::Source), order: Order) {
        let (layer, source) = layer;
        app.world_mut()
            .resource_mut::<SourceStore>()
            .add(source.source_id().to_string(), source);
        app.world_mut().spawn((layer, order));
    }

    /// App holding the terrain quadtree root and the resources `traverse_terrain`
    /// reads. `FramePlugin` advances the frame so `visited_at` is meaningful.
    fn terrain_app_with_root() -> (App, TileHandle) {
        let mut app = App::new();
        app.add_plugins(navara_frame::FramePlugin);

        let mut qt = TerrainTileQuadtree::new_with_linear_qt();
        qt.qt
            .initialize_zero(&|(x, y, z)| TerrainTile::new(TileXYZ { x, y, z }, 0., 0.));
        let handle = qt.qt.zero().unwrap().handle();
        app.insert_resource(qt);

        app.insert_resource(TileCacheManager::default());
        app.insert_resource(BufferStore::default());
        app.insert_resource(DataManager::default());
        app.insert_resource(Window {
            width: 800.,
            height: 600.,
            pixel_ratio: 1.,
        });
        app.insert_resource(LastResult::default());
        app.insert_resource(TraverseConfig { max_sse: 1e30 });
        app.insert_resource(SourceStore::default());

        (app, handle)
    }

    #[test]
    fn traverse_terrain_stops_at_max_zoom_with_not_found() {
        let (mut app, handle) = terrain_app_with_root();
        app.insert_resource(TargetHandle(handle));
        // Layer maxes out at zoom 0; the root (z=0) is already beyond it, so all
        // sources are over their limit and the traversal bails before visiting.
        spawn_layer(&mut app, raster_layer("a", 0, 0), Order(0));

        app.add_systems(Update, run_terrain_traverse);
        app.update();

        assert_eq!(app.world().resource::<LastResult>().0, "notfound");

        // The over-max early-out happens before `begin_traverse_terrain`, so the
        // tile is never stamped with the current frame.
        let frame = app.world().resource::<FrameManager>().rendered_frame();
        let qt = app.world().resource::<TerrainTileQuadtree>();
        assert_ne!(qt.qt.get(handle).unwrap().visited_at, frame);
    }

    #[test]
    fn traverse_terrain_renders_ready_tile_when_sse_satisfied() {
        let (mut app, handle) = terrain_app_with_root();
        app.insert_resource(TargetHandle(handle));
        spawn_layer(&mut app, raster_layer("a", 0, 20), Order(0));
        // Huge threshold: the root's error is acceptable. With no terrain layer the
        // tile is ready (flat geometry), so geometry-first rendering selects it.
        app.insert_resource(TraverseConfig { max_sse: 1e30 });

        app.add_systems(Update, run_terrain_traverse);
        app.update();

        assert_eq!(app.world().resource::<LastResult>().0, "rendered");

        let frame = app.world().resource::<FrameManager>().rendered_frame();
        let qt = app.world().resource::<TerrainTileQuadtree>();
        assert_eq!(qt.qt.get(handle).unwrap().visited_at, frame);

        // The tile's resource was requested while it renders.
        let tc = app.world().resource::<TileCacheManager>();
        assert!(tc.requested_tile_caches.contains(&handle));
    }

    #[test]
    fn traverse_terrain_subdivides_but_keeps_parent_until_children_ready() {
        let (mut app, handle) = terrain_app_with_root();
        app.insert_resource(TargetHandle(handle));
        // max_zoom=1 bounds the forced subdivision to a single level.
        spawn_layer(&mut app, raster_layer("a", 0, 1), Order(0));
        // Zero threshold: the root error is never satisfied, so it subdivides.
        app.insert_resource(TraverseConfig { max_sse: 0. });

        app.add_systems(Update, run_terrain_traverse);
        app.update();

        // The root was subdivided into its 4 children...
        let qt = app.world().resource::<TerrainTileQuadtree>();
        assert!(qt.qt.leaf((0, 0, 1)).is_some(), "root should subdivide");

        // ...but since the children have no prepared mesh, the strict swap keeps
        // the (ready) parent visible instead of hiding it behind holes.
        assert_eq!(app.world().resource::<LastResult>().0, "rendered");
    }

    #[test]
    fn traverse_terrain_culls_occluded_tile() {
        let (mut app, _root) = terrain_app_with_root();
        spawn_layer(&mut app, raster_layer("a", 0, 20), Order(0));

        // A tile on the far side of the globe (centre ~lng 146°, > 60° from the
        // camera), so its horizon-culling point is occluded.
        let occluded = {
            let mut qt = app.world_mut().resource_mut::<TerrainTileQuadtree>();
            qt.qt
                .initialize_leaf((7, 4, 3), &|(x, y, z)| {
                    TerrainTile::new(TileXYZ { x, y, z }, 0., 0.)
                })
                .unwrap()
        };
        app.insert_resource(TargetHandle(occluded));

        app.add_systems(Update, run_terrain_traverse);
        app.update();

        assert_eq!(app.world().resource::<LastResult>().0, "culled");
    }

    /// A minimal renderable `Mesh` whose only meaningful field for traversal is
    /// `active` (drives `is_rendered_tile_activated`).
    fn dummy_mesh(active: bool) -> Mesh {
        Mesh {
            vertices: 0,
            uvs: 0,
            indices: 0,
            active,
            render_order: 0,
            aabb: Aabb::from_vec3(&[Vec3::ZERO]),
            normals: None,
            skirt_vertices: None,
            skirt_uvs: None,
            skirt_indices: None,
            skirt_normals: None,
            watermask: None,
        }
    }

    fn spawn_mesh(app: &mut App, active: bool) -> Entity {
        app.world_mut()
            .spawn((dummy_mesh(active), TileMeshMarker::default()))
            .id()
    }

    /// Insert a render cache entry pointing at a (prepared) mesh, as if the tile
    /// had already been selected and its mesh built.
    fn seed_rendered(app: &mut App, handle: TileHandle, mesh_entity: Entity, prepared: bool) {
        let dummy = app.world_mut().spawn_empty().id();
        let mut tc = app.world_mut().resource_mut::<TileCacheManager>();
        tc.rendered_tile_caches.insert(
            handle,
            RenderedTileCache {
                mesh_entity: Some(mesh_entity),
                ready_parent_tile_handle: None,
                layer_parents: None,
                rendered_tile_entity: dummy,
                mesh_prepared: prepared,
                needs_material_update: false,
            },
        );
    }

    fn mesh_active(app: &App, e: Entity) -> bool {
        app.world().get::<Mesh>(e).unwrap().active
    }

    #[test]
    fn traverse_terrain_swaps_parent_for_children_once_prepared() {
        let (mut app, root) = terrain_app_with_root();
        app.insert_resource(TargetHandle(root));
        // max_zoom=2 bounds the forced subdivision: the z=1 children render, their
        // z=2 grandchildren are over max → NotFound, so each child resolves at z=1.
        spawn_layer(&mut app, raster_layer("a", 0, 2), Order(0));
        app.insert_resource(TraverseConfig { max_sse: 0. });

        // The parent begins visible: a prepared, active mesh.
        let root_mesh = spawn_mesh(&mut app, true);
        seed_rendered(&mut app, root, root_mesh, true);

        app.add_systems(Update, run_terrain_traverse);

        // --- Phase A: children selected but their meshes are not built yet ---
        app.update();
        assert_eq!(
            app.world().resource::<LastResult>().0,
            "rendered",
            "parent stays visible while children load"
        );
        assert!(mesh_active(&app, root_mesh), "parent mesh still shown");

        // The visible children now have render caches (no mesh yet). Far-side
        // children may be occlusion-culled and have none — only seed the rest.
        let rendered_children: Vec<TileHandle> = {
            let qt = app.world().resource::<TerrainTileQuadtree>();
            let tc = app.world().resource::<TileCacheManager>();
            qt.qt
                .children((0, 0, 0))
                .unwrap()
                .iter()
                .map(|c| c.handle())
                .filter(|h| tc.rendered_tile_caches.contains_key(h))
                .collect()
        };
        assert!(
            !rendered_children.is_empty(),
            "at least one child should be rendered while the parent waits"
        );

        // --- Simulate the worker finishing every selected child's mesh ---
        let child_meshes: Vec<Entity> = rendered_children
            .iter()
            .map(|&child| {
                let e = spawn_mesh(&mut app, true);
                let mut tc = app.world_mut().resource_mut::<TileCacheManager>();
                let cache = tc.rendered_tile_caches.get_mut(&child).unwrap();
                cache.mesh_entity = Some(e);
                cache.mesh_prepared = true;
                e
            })
            .collect();

        // --- Phase B: all children prepared → strict swap ---
        app.update();
        assert_eq!(
            app.world().resource::<LastResult>().0,
            "children_prepared",
            "all children prepared → parent hands off to them"
        );
        assert!(
            !mesh_active(&app, root_mesh),
            "parent mesh hidden once children take over"
        );
        for e in child_meshes {
            assert!(mesh_active(&app, e), "child mesh shown after swap");
        }
    }
}
