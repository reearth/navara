use bevy_ecs::prelude::*;
use bevy_log::error;
use navara_buffer_store::BufferStore;
use navara_component::Deleted;
use navara_core::{vec3_to_xyz, xyz_to_vec3, Ellipsoid, Meters, TileXYZ, LLE, WGS84_32};
use navara_data_requester::DataRequesterStatus;
use navara_geometry::tile_triangles_flat;
use navara_math::{FloatType, Transform, Vec3};

use navara_mesh::{CachedMeshHandle, Material, Mesh, MeshBundle, ObjectBundle};
use navara_occluder::ellipsoidal_occluder::EllipsoidalOccluder;
use navara_texture_fragment::TextureFragmentStatus;

use navara_camera::{CameraFrustum, CameraMarker};
use navara_window::Window;

use crate::{
    data_requester::{ChangedTileTerrainDataRequesterQuery, TileTerrainDataRequesterQuery},
    terrain::{CachedMartini, MartiniComponent},
    texture_fragment::{ChangedTileTextureFragmentQuery, TileTextureFragmentQuery},
    tile::TileMeshMarker,
};

use crate::data_requester::request_terrain_data;
use crate::texture_fragment::request_texture_fragment;

use super::{
    event::MeshPreparedEvent,
    render::{RenderedTile, TileOrderByDistance},
    tile_cache_manager::{RenderedTileCache, RequestedTileCache, TileCacheManager},
    RenderedState, Tile, TileHandle, TileQuadtree,
};

use navara_layer::{TerrainLayer, TilesLayer};

pub fn begine_update(mut tc: ResMut<TileCacheManager>) {
    tc.rendered_frame += 1;
}

// We should use entity to store the rendered tile, because the Bevy's entity is extensible.
fn spawn_tile_entity(
    commands: &mut Commands,
    tc: &mut TileCacheManager,
    tile: &mut Tile,
    tile_handle: TileHandle,
    distance_from_camera: FloatType,
) {
    tile.rendered_at = tc.rendered_frame;
    tc.is_updated_in_this_frame = true;

    if tc.rendered_tile_caches.contains_key(&tile_handle) {
        return;
    }

    let e = commands.spawn((
        RenderedTile { tile_handle },
        TileOrderByDistance(distance_from_camera),
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
fn prepare_tile_resource(
    commands: &mut Commands,
    qt: &mut TileQuadtree,
    buf: &mut BufferStore,
    tiles: &TilesLayer,
    terrain_layer: &Option<&TerrainLayer>,
    handle: TileHandle,
    tile_distance: FloatType,
    tc: &mut TileCacheManager,
    texture_fragment: &TileTextureFragmentQuery,
    terrain_data_requester: &TileTerrainDataRequesterQuery,
) -> bool {
    let requested_terrain = request_terrain_data(
        commands,
        qt,
        buf,
        terrain_layer,
        handle,
        tile_distance,
        terrain_data_requester,
    );
    let requested_texture =
        request_texture_fragment(commands, qt, tiles, handle, tile_distance, texture_fragment);

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
    t.bounding_reagion
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

fn find_children(qt: &mut TileQuadtree, handle: TileHandle) -> Option<Vec<(TileHandle, bool)>> {
    let tile = qt.qt.get(handle).unwrap();
    let children = tile.children.clone();
    let coords = (tile.coords.x, tile.coords.y, tile.coords.z);
    let parent_max_height = tile
        .terrain_data
        .as_ref()
        .map_or(0., |t| t.current_max_height().unwrap_or(0.));
    let init = |(x, y, z)| Tile::new(TileXYZ { x, y, z }, parent_max_height);
    if children.is_empty() {
        let children = qt.qt.initialize_children(coords, &init);
        let tile = qt.qt.get_mut(handle).unwrap();
        tile.children = children;
        return None;
    }

    let mut new_children = Vec::with_capacity(4);
    for (i, c) in children.into_iter().enumerate() {
        let is_tile_some = qt.qt.get(c).is_some();
        if is_tile_some {
            new_children.push((c, false));
            continue;
        }
        new_children.push((qt.qt.initialize_child(coords, i, &init), true));
    }
    Some(new_children)
}

// This process works in the following steps.
// 1. Check if the AABB of the tile is within the camera's frustum.(Frustum culling)
// 2. Check horizon culling because the frustum culling isn't enough.
// 3. Check SSE is within max SSE.
// 4. If SSE works and the tile is loaded, the tile should be rendered.
// 5. On the other hand, if SSE works but the tile isn't loaded, the tile should be requested, not rendered.
// 6. If above steps aren't matched, traverse children.
// 7. If children couldn't be rendered completely, use this tile instead.
#[allow(clippy::too_many_arguments)]
fn traverse_tile(
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
            if tile.coords.z >= tiles.max_z {
                let tile = qt.qt.get_mut(handle).unwrap();
                tile.previous_rendered_state = None;
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

    let tile_ready_state =
        tile.is_ready(qt, texture_fragment, terrain_data_requester, terrain_layer);
    let is_tile_ready = tile_ready_state.is_tile_ready;

    // If this tile is failed to load the texture, traverse children.
    // But this tile won't be rendered even if this tile is selected.
    let is_tile_failed = tile.texture_fragment_entity_id.map_or(false, |e| {
        texture_fragment.get(e).map_or(false, |(_, t)| {
            matches!(t.status, TextureFragmentStatus::Fail)
        })
    });

    let previous_rendered_state = &tile.previous_rendered_state;

    // If this tile's children are rendered, we can skip the process
    // to wait for the texture of this tile is loaded.
    let was_children_rendered = matches!(
        previous_rendered_state,
        Some(RenderedState::RenderedChildren)
    );

    let is_rendered_last_frame = tc.rendered_tile_caches.contains_key(&handle);

    let is_culled = !intersect_with_camera_frustum(camera, frustum, tile)  // Frustum culling 
        || !tile
            .occludee_point_in_scaled_space
            .map(|p| occluder.is_scaled_space_point_visible(p))
            .unwrap_or(true); // Occlusion culling

    let distance_from_camera = calc_distance_from_camera(camera, tile, ellipsoid);

    let tile = qt.qt.get_mut(handle).unwrap();
    tile.visited_at = tc.rendered_frame;
    tile.previous_rendered_state = None;

    if is_culled {
        prepare_tile_resource(
            command,
            qt,
            buf,
            tiles,
            terrain_layer,
            handle,
            distance_from_camera,
            tc,
            texture_fragment,
            terrain_data_requester,
        );
        qt.qt.get_mut(handle).unwrap().previous_rendered_state = Some(RenderedState::Culled);
        return TraversalResult::Culled;
    }

    let max_sse = tiles.max_sse;

    let sse = calc_sse(
        frustum,
        tile,
        window,
        ellipsoid,
        if terrain_layer.is_some() { 65. } else { 64. },
        distance_from_camera,
    );
    let meets_sse = sse <= max_sse;

    let is_renderable = is_rendered_last_frame || is_tile_ready;

    if meets_sse {
        prepare_tile_resource(
            command,
            qt,
            buf,
            tiles,
            terrain_layer,
            handle,
            distance_from_camera,
            tc,
            texture_fragment,
            terrain_data_requester,
        );

        if is_renderable {
            return TraversalResult::TileRendered;
        }

        return TraversalResult::NotFound;
    }

    if !is_tile_ready && !was_children_rendered && !is_tile_failed {
        if !meets_sse {
            prepare_tile_resource(
                command,
                qt,
                buf,
                tiles,
                terrain_layer,
                handle,
                distance_from_camera,
                tc,
                texture_fragment,
                terrain_data_requester,
            );
        }
        return TraversalResult::NotFound;
    }

    let children = find_children(qt, handle);

    if let Some(children) = children {
        let mut any_children_rendered = false;
        let mut are_all_children_rendered = true;
        let mut are_children_prepared = true;
        let mut rendered_children_indices = vec![];
        let mut activated_children_indices = vec![];
        let mut hidden_children_indices = vec![];
        for (i, (child, is_created)) in children.iter().enumerate() {
            if *is_created {
                are_all_children_rendered = false;
                are_children_prepared = false;
                continue;
            }

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

            if matches!(traversal_result, TraversalResult::TileRendered)
                && !tc.is_rendered_tile_prepared(child)
            {
                are_children_prepared = false;
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
            for (i, (child, is_created)) in children.iter().enumerate() {
                // If this child is not renderable, skip rendering this child.
                if hidden_children_indices.contains(&i) {
                    continue;
                }

                if *is_created {
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
                spawn_tile_entity(command, tc, tile, handle, distance_from_camera);
            }

            for (i, (child, _)) in children.iter().enumerate() {
                if activated_children_indices.contains(&i) {
                    // Hide parent tile when children are activated.
                    tc.activate_rendered_tile(child, meshes, false);
                    continue;
                }
                // Activate child tile when children are activated.
                tc.activate_rendered_tile(child, meshes, are_children_prepared);
            }

            qt.qt.get_mut(handle).unwrap().previous_rendered_state =
                Some(RenderedState::RenderedChildren);

            if are_children_prepared {
                return TraversalResult::ChildrenMeshesPrepared;
            }

            if are_all_children_rendered {
                // This tile's children are rendered completely, so parent tile isn't rendered.
                return TraversalResult::ChildrenRendered;
            }
        }
    }

    if prepare_tile_resource(
        command,
        qt,
        buf,
        tiles,
        terrain_layer,
        handle,
        distance_from_camera,
        tc,
        texture_fragment,
        terrain_data_requester,
    ) {
        return TraversalResult::NotFound;
    }

    TraversalResult::TileRendered
}

#[allow(clippy::too_many_arguments, clippy::type_complexity)]
pub fn update_tiles(
    mut commands: Commands,
    mut qt: ResMut<TileQuadtree>,
    mut tc: ResMut<TileCacheManager>,
    mut buf: ResMut<BufferStore>,
    window: Res<Window>,
    tiles: Query<&TilesLayer>,
    terrain_layer: Query<&TerrainLayer>,
    camera: Query<(&CameraMarker, Ref<Transform>, &CameraFrustum)>,
    texture_fragment: TileTextureFragmentQuery,
    changed_texture_fragment: ChangedTileTextureFragmentQuery,
    terrain_data_requester: TileTerrainDataRequesterQuery,
    changed_terrain_data_requester: ChangedTileTerrainDataRequesterQuery,
    occluder: Query<&EllipsoidalOccluder>,
    mut meshes_set: ParamSet<(
        // All meshes
        Query<&mut Mesh, (With<TileMeshMarker>, Without<Deleted>)>,
        // All changed meshes
        Query<
            &Mesh,
            (
                Or<(Added<Mesh>, Changed<Mesh>)>,
                With<TileMeshMarker>,
                Without<Deleted>,
            ),
        >,
    )>,
) {
    let is_texture_fragment_changed = !changed_texture_fragment.is_empty();
    let is_data_requester_changed = !changed_terrain_data_requester.is_empty();
    let is_mesh_changed = !meshes_set.p1().is_empty();

    let mut meshes = meshes_set.p0();

    // TODO: Think how to support multiple terrain layer.(Is it possible?)
    let terrain_layer = terrain_layer.iter().next();

    let occluder = occluder.iter().next().unwrap();
    // TODO: Support multiple tiles
    for tiles in &tiles {
        for (_, camera, frustum) in &camera {
            let needs_update = is_texture_fragment_changed
                || is_data_requester_changed
                || is_mesh_changed
                || tc.is_updated_in_this_frame
                || camera.is_added()
                || camera.is_changed();
            if !needs_update {
                continue;
            }

            tc.is_updated_in_this_frame = true;

            let zero_tile = match qt.qt.zero() {
                Some(z) => z,
                None => {
                    qt.qt
                        .initialize_zero(&|(x, y, z)| Tile::new(TileXYZ { x, y, z }, 0.));
                    qt.qt
                        .zero()
                        .expect("Failed to initialize a level zero tile unexpectedly")
                }
            };
            match traverse_tile(
                &mut commands,
                tiles,
                &terrain_layer,
                zero_tile.handle(),
                &mut tc,
                &mut qt,
                &mut buf,
                &camera,
                frustum,
                &texture_fragment,
                &terrain_data_requester,
                &window,
                &WGS84_32,
                occluder,
                &mut meshes,
            ) {
                TraversalResult::TileRendered => {
                    spawn_tile_entity(
                        &mut commands,
                        &mut tc,
                        qt.qt.get_mut(zero_tile.handle()).unwrap(),
                        zero_tile.handle(),
                        0.,
                    );
                }
                TraversalResult::NotFound => {
                    prepare_tile_resource(
                        &mut commands,
                        &mut qt,
                        &mut buf,
                        tiles,
                        &terrain_layer,
                        zero_tile.handle(),
                        0.,
                        &mut tc,
                        &texture_fragment,
                        &terrain_data_requester,
                    );
                }
                _ => {
                    // Alway shows level zero tile.
                    tc.activate_rendered_tile(&zero_tile.handle(), &mut meshes, true);
                }
            };
        }
    }
}

#[allow(clippy::too_many_arguments)]
pub fn transfer_mesh(
    mut commands: Commands,
    mut buf: ResMut<BufferStore>,
    mut tc: ResMut<TileCacheManager>,
    mut qt: ResMut<TileQuadtree>,
    cached_martini: Res<CachedMartini>,
    rendered_tiles: Query<(&RenderedTile, &TileOrderByDistance), Added<RenderedTile>>,
    terrain_data_requester: TileTerrainDataRequesterQuery,
    tile_layers: Query<&TilesLayer>,
    terrain_layer: Query<&TerrainLayer>,
    mut martini_components: Query<&mut MartiniComponent>,
) {
    if !tc.is_updated_in_this_frame {
        return;
    }

    // TODO: Support mutiple tile layers
    let tile_layer = match tile_layers.iter().next() {
        Some(tile) => tile,
        None => return,
    };

    // TODO: Support mutiple terrain layers
    let terrain_layer = terrain_layer.iter().next();

    for (rendered_tile, _) in rendered_tiles.iter().sort::<&TileOrderByDistance>() {
        let tile = qt.qt.get(rendered_tile.tile_handle).unwrap();
        let is_root = tile.is_root();
        let scale = if is_root { 0.98 } else { 1. };
        let render_order = if is_root { -1 } else { 0 };

        let extent = tile.extent;

        let should_render_terrain = terrain_layer.is_some();
        let should_compute_normal_from_vertex =
            terrain_layer.map_or(false, |t| t.should_compute_normal_from_vertex);

        let texture_fragment_entity_id = tile.texture_fragment_entity_id;

        let terrain_req = match tile.terrain_data.as_ref() {
            Some(t) => t
                .data_requester_entity_id()
                .and_then(|e| terrain_data_requester.get(e).map_or(None, |v| Some(v.1))),
            None => None,
        };
        let is_terrain_failed = matches!(
            terrain_req.map(|t| &t.status),
            Some(&DataRequesterStatus::Fail)
        );

        let should_upsample_terrain = tile.should_upsampling(terrain_layer.map_or(1, |t| t.max_z))
            && tile.is_upsamplable(&qt, &terrain_data_requester, &terrain_layer);

        if !should_render_terrain
            || (terrain_layer.map_or(false, |t| t.min_z >= tile.coords.z)
                || (!should_upsample_terrain && is_terrain_failed))
        {
            let triangles = tile_triangles_flat(
                WGS84_32,
                &extent,
                if is_root { 65 } else { tile_layer.segments },
                0.,
            );

            let vhandle = buf.new_f32(triangles.vertices);
            let ihandle = buf.new_u32(triangles.indices);
            let uvshandle = buf.new_f32(triangles.uvs);
            {
                if let Some(t) = qt.qt.get_mut(rendered_tile.tile_handle) {
                    t.cached_mesh_handle = Some(CachedMeshHandle {
                        vertices: vhandle,
                        indices: ihandle,
                        uvs: uvshandle,
                        heights: None,
                    });
                };
            }

            let e = commands.spawn((
                TileMeshMarker(rendered_tile.tile_handle),
                MeshBundle {
                    mesh: Mesh {
                        vertices: vhandle,
                        indices: ihandle,
                        uvs: uvshandle,
                        active: false,
                        render_order,
                    },
                    material: Material {
                        color: tile_layer.color,
                        show: tile_layer.show,
                        wireframe: tile_layer.wireframe,
                        should_compute_normal_from_vertex,
                        texture_fragment: texture_fragment_entity_id,
                    },
                    object: ObjectBundle {
                        transform: Transform::from_scale(Vec3::new(scale, scale, scale)),
                        marker: Default::default(),
                    },
                },
            ));

            if let Some(cache) = tc.rendered_tile_caches.get_mut(&rendered_tile.tile_handle) {
                cache.mesh_entity = Some(e.id());
            };
            continue;
        }

        let terrain_layer = terrain_layer.unwrap();

        fn postupdate_tile(tile: &mut Tile, max_height: FloatType, min_height: FloatType) {
            let terrain_data = tile
                .terrain_data
                .as_mut()
                .expect("This line is invoked only in the tile has terrain");
            terrain_data.set_current_max_height(max_height);
            terrain_data.set_current_min_height(min_height);
            tile.aabb.update(tile.extent, 0., max_height)
        }

        if should_upsample_terrain {
            let (geometry, heights, max_height, min_height) =
                tile.upsample(WGS84_32, &qt, &buf).unwrap();
            let vhandle = buf.new_f32(geometry.vertices);
            let ihandle = buf.new_u32(geometry.indices);
            let uvshandle = buf.new_f32(geometry.uvs);
            let heights_handle = buf.new_f32(heights);
            {
                if let Some(t) = qt.qt.get_mut(rendered_tile.tile_handle) {
                    t.cached_mesh_handle = Some(CachedMeshHandle {
                        vertices: vhandle,
                        indices: ihandle,
                        uvs: uvshandle,
                        heights: Some(heights_handle),
                    });
                    t.upsampled = true;
                };
            }

            let e = commands.spawn((
                TileMeshMarker(rendered_tile.tile_handle),
                MeshBundle {
                    mesh: Mesh {
                        vertices: vhandle,
                        indices: ihandle,
                        uvs: uvshandle,
                        active: false,
                        render_order,
                    },
                    material: Material {
                        color: tile_layer.color,
                        show: tile_layer.show,
                        wireframe: terrain_layer.wireframe,
                        should_compute_normal_from_vertex: terrain_layer
                            .should_compute_normal_from_vertex,
                        texture_fragment: texture_fragment_entity_id,
                    },
                    object: ObjectBundle {
                        transform: Transform::from_scale(Vec3::new(scale, scale, scale)),
                        marker: Default::default(),
                    },
                },
            ));

            if let Some(cache) = tc.rendered_tile_caches.get_mut(&rendered_tile.tile_handle) {
                cache.mesh_entity = Some(e.id());
            };
            let tile = qt.qt.get_mut(rendered_tile.tile_handle).unwrap();
            postupdate_tile(tile, max_height, min_height);

            continue;
        }

        let terrain_req = terrain_req.unwrap();

        // FIXME: This data will be removable after terrain mesh is constructed.
        let bytes = match buf.get_u8(&terrain_req.handle) {
            Some(data) => data,
            None => {
                error!("This line should be invoked only when the terrain data is ready");
                continue;
            }
        };

        let martini_id = cached_martini
            .get(&terrain_layer.tile_size)
            .expect("It must be initialized when terrain layer is added");
        let mut martini = martini_components.get_mut(*martini_id).unwrap();

        let (triangles, max_height, min_height, heights) = tile
            .terrain_data
            .as_ref()
            .unwrap()
            .construct_terrain_mesh(WGS84_32, tile, bytes, 0., martini.get_mut());

        let vhandle = buf.new_f32(triangles.vertices);
        let ihandle = buf.new_u32(triangles.indices);
        let uvshandle = buf.new_f32(triangles.uvs);
        let heights_handle = buf.new_f32(heights);
        {
            if let Some(t) = qt.qt.get_mut(rendered_tile.tile_handle) {
                t.cached_mesh_handle = Some(CachedMeshHandle {
                    vertices: vhandle,
                    indices: ihandle,
                    uvs: uvshandle,
                    heights: Some(heights_handle),
                })
            };
        }

        let e = commands.spawn((
            TileMeshMarker(rendered_tile.tile_handle),
            MeshBundle {
                mesh: Mesh {
                    vertices: vhandle,
                    indices: ihandle,
                    uvs: uvshandle,
                    active: false,
                    render_order,
                },
                material: Material {
                    color: tile_layer.color,
                    show: tile_layer.show,
                    wireframe: terrain_layer.wireframe,
                    should_compute_normal_from_vertex: terrain_layer
                        .should_compute_normal_from_vertex,
                    texture_fragment: texture_fragment_entity_id,
                },
                object: ObjectBundle {
                    transform: Transform::from_scale(Vec3::new(scale, scale, scale)),
                    marker: Default::default(),
                },
            },
        ));
        if let Some(cache) = tc.rendered_tile_caches.get_mut(&rendered_tile.tile_handle) {
            cache.mesh_entity = Some(e.id());
        };

        let tile = qt.qt.get_mut(rendered_tile.tile_handle).unwrap();
        postupdate_tile(tile, max_height, min_height);
    }
}

pub fn handle_prepared_mesh_event(
    mut events: EventReader<MeshPreparedEvent>,
    mut tc: ResMut<TileCacheManager>,
) {
    for e in events.read() {
        if let Some(t) = tc.rendered_tile_caches.get_mut(&e.tile_handle) {
            t.mesh_prepared = true;
        } else {
            continue;
        }
        tc.is_updated_in_this_frame = true;
    }
}

pub fn clear_caches(
    mut commands: Commands,
    mut tc: ResMut<TileCacheManager>,
    mut qt: ResMut<TileQuadtree>,
    mut buf: ResMut<BufferStore>,
    rendered_tiles: Query<(Entity, &RenderedTile, &TileOrderByDistance)>,
    terrain_data_requester: TileTerrainDataRequesterQuery,
) {
    if !tc.is_updated_in_this_frame {
        tc.is_updated_in_this_frame = false;
        return;
    }
    tc.is_updated_in_this_frame = false;

    let now = instant::Instant::now();
    for (rendered_tile_entity_id, rendered_tile, _) in
        rendered_tiles.iter().sort::<&TileOrderByDistance>().rev()
    {
        // Prevent blocking the frame by this deletion process
        if now.elapsed() > instant::Duration::from_micros(1) {
            break;
        }

        let visited_at = {
            let tile = qt.qt.get(rendered_tile.tile_handle).unwrap();
            tile.visited_at
        };

        if tc.rendered_frame <= visited_at + 1 {
            continue;
        }

        let cache = match tc.rendered_tile_caches.get(&rendered_tile.tile_handle) {
            Some(cache) => cache,
            None => continue,
        };

        if let Some(mesh_entity) = cache.mesh_entity {
            commands.entity(mesh_entity).insert(Deleted);
        }
        commands.entity(rendered_tile_entity_id).despawn();
        tc.rendered_tile_caches.remove(&rendered_tile.tile_handle);
        tc.requested_tile_caches.remove(&rendered_tile.tile_handle);

        qt.qt.get_mut(rendered_tile.tile_handle).unwrap().destroy(
            &mut commands,
            &mut buf,
            &terrain_data_requester,
        );
    }

    let mut removed_handles = vec![];
    for (handle, _requested) in tc.requested_tile_caches.iter() {
        // Prevent blocking the frame by this deletion process
        if now.elapsed() > instant::Duration::from_micros(1) {
            break;
        }

        let tile_handle = *handle;

        let visited_at = {
            let tile = qt.qt.get(tile_handle).unwrap();
            tile.visited_at
        };

        if tc.rendered_frame <= visited_at + 1 {
            continue;
        }

        qt.qt.get_mut(tile_handle).unwrap().destroy(
            &mut commands,
            &mut buf,
            &terrain_data_requester,
        );

        removed_handles.push(tile_handle);
    }

    for removed in removed_handles {
        tc.requested_tile_caches.remove(&removed);
    }
}
