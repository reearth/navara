use bevy_ecs::prelude::*;
use navara_buffer_store::BufferStore;
use navara_component::{Deleted, OrderByDistance, Priority};
use navara_core::{vec3_to_xyz, xyz_to_vec3, Ellipsoid, Meters, TileXYZ, LLE};

use navara_math::{FloatType, Transform, Vec3};

use navara_mesh::Mesh;
use navara_occluder::ellipsoidal_occluder::EllipsoidalOccluder;

use navara_camera::CameraFrustum;
use navara_tile_component::{
    Tile, TileHandle, TileMeshMarker, TileQuadtree, TileTerrainDataRequesterQuery,
    TileTextureFragmentQuery,
};
use navara_window::Window;

use crate::data_requester::request_terrain_data;
use crate::texture_fragment::request_texture_fragment;

use super::{
    render::RenderedTile,
    tile_cache_manager::{RenderedTileCache, RequestedTileCache, TileCacheManager},
};

use navara_layer::{TerrainLayer, TilesLayer};

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
    tiles: &TilesLayer,
    terrain_layer: &Option<&TerrainLayer>,
    handle: TileHandle,
    tc: &mut TileCacheManager,
    qt: &mut TileQuadtree,
    buf: &mut BufferStore,
    camera: &Transform,
    frustum: &CameraFrustum,
    texture_fragment: &TileTextureFragmentQuery,
    terrain_data_requester: &TileTerrainDataRequesterQuery,
    window: &Window,
    ellipsoid: &Ellipsoid<FloatType>,
    occluder: &EllipsoidalOccluder,
    meshes: &mut Query<&mut Mesh, (With<TileMeshMarker>, Without<Deleted>)>,
) -> TraversalResult {
    match qt.qt.get(handle) {
        Some(tile) => {
            if tile.coords.z >= tiles.appearance.as_ref().unwrap().max_zoom {
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

    let is_culled_by_frustum = !intersect_with_camera_frustum(camera, frustum, tile);
    if is_culled_by_frustum {
        // Preload culled frustum nearby this tile.
        // Assuming the tile is far away.
        let tile = qt.qt.get_mut(handle).unwrap();
        tile.sse = 9999.;
        tile.distance_from_camera = 9999.;
        tile.visited_at = tc.rendered_frame;

        prepare_tile_resource(
            command,
            tile,
            buf,
            tiles,
            terrain_layer,
            handle,
            tc,
            texture_fragment,
            terrain_data_requester,
            Priority::Low,
        );
        return TraversalResult::Culled;
    }

    let is_culled_by_occlusion = !tile
        .occludee_point_in_scaled_space
        .map(|p| occluder.is_scaled_space_point_visible(p))
        .unwrap_or(true);
    if is_culled_by_occlusion {
        return TraversalResult::Culled;
    }

    let tile_ready_state =
        tile.is_ready(qt, texture_fragment, terrain_data_requester, terrain_layer);
    let is_tile_ready = tile_ready_state.is_tile_ready;

    let is_rendered_last_frame = tc.rendered_tile_caches.contains_key(&handle);

    let distance_from_camera = calc_distance_from_camera(camera, tile, ellipsoid);
    let sse = calc_sse(
        frustum,
        tile,
        window,
        ellipsoid,
        if terrain_layer.is_some() { 65. } else { 64. },
        distance_from_camera,
    );

    let tile = qt.qt.get_mut(handle).unwrap();
    tile.sse = sse;
    tile.distance_from_camera = distance_from_camera;
    tile.visited_at = tc.rendered_frame;

    let max_sse = tiles.appearance.as_ref().unwrap().max_sse;
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
            tiles,
            terrain_layer,
            handle,
            tc,
            texture_fragment,
            terrain_data_requester,
            Priority::Medium,
        );

        return TraversalResult::NotFound;
    }

    if let Some(children) = find_children(qt, handle) {
        let mut any_children_rendered = false;
        let mut are_all_children_rendered = true;
        let mut are_children_prepared = true;
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
                camera,
                frustum,
                texture_fragment,
                terrain_data_requester,
                window,
                ellipsoid,
                occluder,
                meshes,
            );

            if matches!(traversal_result, TraversalResult::NotFound) {
                are_all_children_rendered = false;
                are_children_prepared = false;
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
            ) {
                any_children_rendered = true;
            }

            // If tile's mesh isn't ready, render the parent tile.
            if (matches!(traversal_result, TraversalResult::TileRendered)
                && !tc.is_rendered_tile_prepared(child))
            {
                are_children_prepared = false;
                are_all_children_rendered = false;
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
                spawn_tile_entity(command, tc, tile, handle);
            }

            for (i, child) in children.iter().enumerate() {
                if activated_children_indices.contains(&i) | hidden_children_indices.contains(&i) {
                    // Hide parent tile when children are activated.
                    tc.activate_rendered_tile(child, meshes, false);
                    continue;
                }
                // Activate child tile when children are activated.
                tc.activate_rendered_tile(child, meshes, are_children_prepared);
            }

            if are_children_prepared {
                return TraversalResult::ChildrenMeshesPrepared;
            }

            if are_all_children_rendered {
                // This tile's children are rendered completely, so parent tile isn't rendered.
                return TraversalResult::ChildrenRendered;
            }
        }
    }

    if !is_renderable {
        let tile = qt.qt.get_mut(handle).unwrap();
        prepare_tile_resource(
            command,
            tile,
            buf,
            tiles,
            terrain_layer,
            handle,
            tc,
            texture_fragment,
            terrain_data_requester,
            Priority::High,
        );

        return TraversalResult::NotFound;
    }

    TraversalResult::TileRendered
}

// We should use entity to store the rendered tile, because the Bevy's entity is extensible.
pub fn spawn_tile_entity(
    commands: &mut Commands,
    tc: &mut TileCacheManager,
    tile: &mut Tile,
    tile_handle: TileHandle,
) {
    tile.rendered_at = tc.rendered_frame;
    tc.is_updated_in_this_frame = true;

    if tc.rendered_tile_caches.contains_key(&tile_handle) {
        return;
    }

    let e = commands.spawn((
        RenderedTile {
            tile_handle,
            ..Default::default()
        },
        OrderByDistance(tile.distance_from_camera),
    ));
    tc.rendered_tile_caches.insert(
        tile_handle,
        RenderedTileCache {
            rendered_tile_entity: e.id(),
            mesh_entity: None,
            mesh_prepared: false,
        },
    );
}

/// Prepare some resource that is necessary to render the tile.
/// This returns whether the resource is requested or not.
#[allow(clippy::too_many_arguments)]
pub fn prepare_tile_resource(
    commands: &mut Commands,
    tile: &mut Tile,
    buf: &mut BufferStore,
    tiles: &TilesLayer,
    terrain_layer: &Option<&TerrainLayer>,
    handle: TileHandle,
    tc: &mut TileCacheManager,
    texture_fragment: &TileTextureFragmentQuery,
    terrain_data_requester: &TileTerrainDataRequesterQuery,
    priority: Priority,
) -> bool {
    let requested_terrain = request_terrain_data(
        commands,
        tile,
        buf,
        terrain_layer,
        handle,
        terrain_data_requester,
        priority,
    );
    let requested_texture =
        request_texture_fragment(commands, tile, tiles, handle, texture_fragment, priority);

    match tc.requested_tile_caches.get_mut(&handle) {
        Some(r) => {
            if requested_terrain.is_some() {
                r.data_requester = requested_terrain;
            }
            if requested_texture.is_some() {
                r.texture_fragment = requested_texture;
            }
        }
        None => {
            tc.requested_tile_caches.insert(
                handle,
                RequestedTileCache {
                    data_requester: requested_terrain,
                    texture_fragment: requested_texture,
                },
            );
        }
    }

    requested_terrain.is_some() || requested_texture.is_some()
}

fn intersect_with_camera_frustum(_camera: &Transform, frustum: &CameraFrustum, t: &Tile) -> bool {
    frustum.intersection_with_aabb(&t.aabb)||
    // Avoid frustum culling with root tile
    t.is_root()
}

fn calc_distance_from_camera(
    camera: &Transform,
    t: &Tile,
    ellipsoid: &Ellipsoid<FloatType>,
) -> FloatType {
    let camera_pos = camera.transform_point(Vec3::ZERO);
    t.bounding_region
        .as_ref()
        .unwrap()
        .distance_to_camera(camera_pos, ellipsoid.xyz_to_lle(vec3_to_xyz(camera_pos)))
}

// Ref: https://github.com/CesiumGS/cesium/blob/3b393448d7e976165c0260fab9ea90843583c3a7/packages/engine/Source/Scene/QuadtreePrimitive.js#L1245
fn calc_sse(
    frustum: &CameraFrustum,
    t: &Tile,
    window: &Window,
    ellipsoid: &Ellipsoid<FloatType>,
    height_map_width: FloatType,
    distance_from_camera: FloatType,
) -> FloatType {
    let max_geometric_error = t.get_level_maximum_geometric_error(ellipsoid, height_map_width);

    // TODO: Support fog culling

    (max_geometric_error * window.height)
        / (distance_from_camera * frustum.sse_denominator)
        / window.pixel_ratio
}

fn begine_traverse_tile(
    ellipsoid: &Ellipsoid<FloatType>,
    occluder: &EllipsoidalOccluder,
    _camera: &Transform,
    tile: &mut Tile,
) {
    update_tile_occludee_point(ellipsoid, occluder, tile)
}

fn update_tile_occludee_point(
    ellipsoid: &Ellipsoid<FloatType>,
    occluder: &EllipsoidalOccluder,
    tile: &mut Tile,
) {
    if tile.occludee_point_in_scaled_space.is_some() {
        return;
    }

    let extent = tile.extent;
    let center = tile.aabb.center;
    let max_height = match tile.terrain_data.as_ref() {
        Some(t) => t.current_max_height().map_or(Meters::new(0.), Meters::new),
        None => Meters::new(0.),
    };

    let positions = vec![
        xyz_to_vec3(ellipsoid.lle_to_xyz(LLE {
            lng: extent.west,
            lat: extent.south,
            height: max_height,
        })),
        xyz_to_vec3(ellipsoid.lle_to_xyz(LLE {
            lng: extent.east,
            lat: extent.south,
            height: max_height,
        })),
        xyz_to_vec3(ellipsoid.lle_to_xyz(LLE {
            lng: extent.west,
            lat: extent.north,
            height: max_height,
        })),
        xyz_to_vec3(ellipsoid.lle_to_xyz(LLE {
            lng: extent.east,
            lat: extent.north,
            height: max_height,
        })),
    ];

    tile.occludee_point_in_scaled_space =
        occluder.compute_horizontal_culling_point(ellipsoid, center, positions);
}

pub(super) enum TraversalResult {
    TileRendered,
    ChildrenRendered,
    ChildrenMeshesPrepared,
    Culled,
    NotFound,
}

fn find_children(qt: &mut TileQuadtree, handle: TileHandle) -> Option<Vec<TileHandle>> {
    let tile = qt.qt.get(handle).unwrap();
    let children = tile.children.clone();
    let coords = (tile.coords.x, tile.coords.y, tile.coords.z);
    let parent_max_height = tile
        .terrain_data
        .as_ref()
        .map_or(0., |t| t.current_max_height().unwrap_or(0.));
    let init = |(x, y, z)| Tile::new(TileXYZ { x, y, z }, parent_max_height);
    if children.is_empty() {
        let children = qt.qt.initialize_children(coords, &init)?;
        let tile = qt.qt.get_mut(handle).unwrap();
        tile.children = children.clone();
        return Some(children);
    }

    let mut new_children = Vec::with_capacity(4);
    for (i, c) in children.into_iter().enumerate() {
        let is_tile_some = qt.qt.get(c).is_some();
        if is_tile_some {
            new_children.push(c);
            continue;
        }
        new_children.push(qt.qt.initialize_child(coords, i, &init)?);
    }
    Some(new_children)
}
