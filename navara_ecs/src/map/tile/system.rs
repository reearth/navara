use bevy_ecs::prelude::*;
use bevy_math::Vec3;
use navara_core::{
    terrain::{
        get_ellipsoid_terrain_level_zero_maximum_geometric_error_f32,
        get_level_maximum_geometric_error_f32,
    },
    tile_geometry::{tile_triangles_flat, tile_triangles_with_terrain},
    Ellipsoid, Meters, TileXYZ, LLE, WGS84_32,
};

use navara_quadtree::GeoSpacialQuadLeaf;

use crate::{
    camera::{CameraFrustum, CameraMarker},
    map::terrain::{layer::TerrainLayer, RasterDEMData, TerrainData, TerrainDataType},
    occluder::ellipsoidal_occluder::EllipsoidalOccluder,
    utils::coord::{vec3_to_xyz, xyz_to_vec3},
    window::Window,
    BufferStore, CachedMeshHandle, DataRequester, DataRequesterStatus, Material, Mesh, MeshBundle,
    ObjectBundle, TextureFragment, TextureFragmentStatus, Transform,
};

use super::{
    layer::TilesLayer,
    terrain::TerrainDataRequesterMarker,
    tile_cache_manager::{TileCache, TileCacheManager},
    RenderedState, Tile, TileHandle, TileQuadtree, TileTextureFragmentMarker,
};

#[derive(Component)]
pub struct RenderedTile {
    tile_handle: TileHandle,
}

pub fn begine_update(mut tc: ResMut<TileCacheManager>) {
    tc.rendered_frame += 1;
}

// We should use entity to store the rendered tile, because the Bevy's entity is extensible.
fn spawn_tile_entity(
    commands: &mut Commands,
    tc: &mut TileCacheManager,
    tile: &mut Tile,
    tile_handle: TileHandle,
) {
    tile.rendered_at = tc.rendered_frame;
    tc.is_updated_in_this_frame = true;

    if tc.rendered_tile_caches.get_mut(&tile_handle).is_some() {
        return;
    }

    commands.spawn(RenderedTile { tile_handle });
    tc.rendered_tile_caches
        .insert(tile_handle, TileCache { mesh_entity: None });
}

fn request_texture_fragment(
    commands: &mut Commands,
    qt: &mut TileQuadtree,
    tiles: &TilesLayer,
    handle: TileHandle,
) -> bool {
    let tile = qt.qt.get_mut(handle).unwrap();
    if tile.texture_fragment_entity_id.is_some() {
        return false;
    }

    let url = tile_url(&tiles.url, &tile.coords);
    let entity = commands.spawn((TileTextureFragmentMarker, TextureFragment::new(url)));
    tile.texture_fragment_entity_id = Some(entity.id());

    true
}

fn request_terrain_data(
    commands: &mut Commands,
    qt: &mut TileQuadtree,
    buf: &mut BufferStore,
    terrain_layer: &Option<&TerrainLayer>,
    handle: TileHandle,
) -> bool {
    let tile = qt.qt.get_mut(handle).unwrap();
    let data_requester_entity_id = tile
        .terrain_data
        .as_ref()
        .and_then(|t| t.data_requester_entity_id());
    if data_requester_entity_id.is_some() {
        return false;
    }
    match terrain_layer.map(|t| (&t.terrain_type, tile_url(&t.url, &tile.coords))) {
        Some((terrain_type, url)) => {
            let mut terrain_data = match terrain_type {
                TerrainDataType::RasterDEM => RasterDEMData::default(), // DEM
                // TODO: Support quantized-mesh
                TerrainDataType::QuantizedMesh => unimplemented!(), // quantized-mesh
                TerrainDataType::Unknown => return false,
            };
            let entity = commands.spawn((
                TerrainDataRequesterMarker,
                DataRequester::from_store(url, buf),
            ));
            terrain_data.set_data_requester_entity_id(Some(entity.id()));
            tile.terrain_data = Some(Box::new(terrain_data));
        }
        None => return false,
    }
    true
}

// Prepare some resource that is necessary to render the tile.
// This returns whether the resource is requested or not.
fn prepare_tile_resource(
    commands: &mut Commands,
    qt: &mut TileQuadtree,
    buf: &mut BufferStore,
    tiles: &TilesLayer,
    terrain_layer: &Option<&TerrainLayer>,
    handle: TileHandle,
) -> bool {
    request_terrain_data(commands, qt, buf, terrain_layer, handle)
        || request_texture_fragment(commands, qt, tiles, handle)
}

fn intersect_with_camera_frustum(_camera: &Transform, frustum: &CameraFrustum, t: &Tile) -> bool {
    frustum.interseciton_with_aabb(&t.aabb)
}

// Ref: https://github.com/CesiumGS/cesium/blob/3b393448d7e976165c0260fab9ea90843583c3a7/packages/engine/Source/Scene/QuadtreePrimitive.js#L1245
fn calc_sse(
    camera: &Transform,
    frustum: &CameraFrustum,
    t: &Tile,
    window: &Window,
    ellipsoid: &Ellipsoid<f32>,
    height_map_width: f32,
) -> f32 {
    let max_geometric_error = get_level_maximum_geometric_error_f32(
        t.coords.z,
        // TODO: Store the result of the level zero maximum geometric error to avoid too many caclulation.
        get_ellipsoid_terrain_level_zero_maximum_geometric_error_f32(ellipsoid, height_map_width),
    );

    let camera_pos = camera.transform_point(Vec3::ZERO);
    let distance_from_camera = t
        .bounding_reagion
        .as_ref()
        .unwrap()
        .distance_to_camera(camera_pos, ellipsoid.xyz_to_lle(vec3_to_xyz(camera_pos)));

    // TODO: Support fog culling

    (max_geometric_error * window.height)
        / (distance_from_camera * frustum.sse_denominator)
        / window.pixel_ratio
}

fn begine_traverse_tile(
    ellipsoid: &Ellipsoid<f32>,
    occluder: &EllipsoidalOccluder,
    _camera: &Transform,
    tile: &mut Tile,
) {
    update_tile_occludee_point(ellipsoid, occluder, tile)
}

fn update_tile_occludee_point(
    ellipsoid: &Ellipsoid<f32>,
    occluder: &EllipsoidalOccluder,
    tile: &mut Tile,
) {
    let extent = tile.coords.extent();
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
    TileRenderedPartially,
    ChildrenRendered,
    Culled,
    NotFound,
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
    t: &dyn GeoSpacialQuadLeaf<usize>,
    tc: &mut TileCacheManager,
    qt: &mut TileQuadtree,
    buf: &mut BufferStore,
    camera: &Transform,
    frustum: &CameraFrustum,
    texture_fragment: &Query<(&TileTextureFragmentMarker, &TextureFragment)>,
    terrain_data_requester: &Query<(&TerrainDataRequesterMarker, &DataRequester)>,
    window: &Window,
    ellipsoid: &Ellipsoid<f32>,
    occluder: &EllipsoidalOccluder,
) -> TraversalResult {
    match qt.qt.get(t.handle()) {
        Some(tile) => {
            if tile.coords.z >= tiles.max_z {
                return TraversalResult::NotFound;
            }
        }
        None => unreachable!(),
    };

    match qt.qt.get_mut(t.handle()) {
        Some(tile) => begine_traverse_tile(ellipsoid, occluder, camera, tile),
        None => unreachable!(),
    };

    let tile = match qt.qt.get(t.handle()) {
        Some(tile) => tile,
        None => unreachable!(),
    };

    let is_tile_ready = tile.is_ready(qt, texture_fragment, terrain_data_requester, terrain_layer);

    // If this tile is failed to load the texture, traverse children.
    // But this tile won't be rendered even if this tile is selected.
    let is_tile_failed = tile.texture_fragment_entity_id.map_or(false, |e| {
        texture_fragment.get(e).map_or(false, |(_, t)| {
            matches!(t.status, TextureFragmentStatus::Fail)
        })
    });

    // If this tile's children are rendered, we can skip the process
    // to wait for the texture of this tile is loaded.
    let was_children_rendered = matches!(
        tile.previous_rendered_state,
        Some(RenderedState::RenderedChildren)
    );

    let is_rendered_last_frame = tc.rendered_tile_caches.contains_key(&t.handle());

    let is_intersecting_with_frustum = intersect_with_camera_frustum(camera, frustum, tile);
    if !is_intersecting_with_frustum {
        qt.qt.get_mut(t.handle()).unwrap().previous_rendered_state = Some(RenderedState::Culled);
        return TraversalResult::Culled;
    }

    let is_visible = tile
        .occludee_point_in_scaled_space
        .map(|p| occluder.is_scaled_space_point_visible(p))
        .unwrap_or(true);
    if !is_visible {
        qt.qt.get_mut(t.handle()).unwrap().previous_rendered_state = Some(RenderedState::Culled);
        return TraversalResult::Culled;
    }

    let max_sse = tiles.max_sse;

    let sse = calc_sse(
        camera,
        frustum,
        tile,
        window,
        ellipsoid,
        if terrain_layer.is_some() { 65. } else { 64. },
    );
    let meets_sse = sse < max_sse;

    let is_renderable = is_rendered_last_frame || is_tile_ready;

    {
        qt.qt.get_mut(t.handle()).unwrap().visited_at = tc.rendered_frame;
    }

    if meets_sse {
        qt.qt.get_mut(t.handle()).unwrap().previous_rendered_state = None;

        if is_tile_failed {
            return TraversalResult::NotFound;
        }

        if is_renderable {
            return TraversalResult::TileRendered;
        }
        prepare_tile_resource(command, qt, buf, tiles, terrain_layer, t.handle());
    } else {
        prepare_tile_resource(command, qt, buf, tiles, terrain_layer, t.handle());
    }

    if !is_tile_ready && !was_children_rendered && !is_tile_failed {
        return TraversalResult::NotFound;
    }

    let children = qt
        .qt
        .get_or_create_children(t.coords(), &|(x, y, z)| Tile::new(TileXYZ { x, y, z }));

    let mut are_children_rendered = false;
    let mut are_all_children_rendered = true;
    let mut rendered_children_indices = vec![];
    let mut hidden_children_indices = vec![];
    for (i, child) in children.iter().enumerate() {
        let traversal_result = traverse_tile(
            command,
            tiles,
            terrain_layer,
            child.as_ref(),
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
        );

        if matches!(traversal_result, TraversalResult::NotFound) {
            are_all_children_rendered = false;
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
                | TraversalResult::TileRenderedPartially
                | TraversalResult::ChildrenRendered
        ) {
            are_children_rendered = true;
        }

        // Skip rendering chilren in this tile.
        if matches!(traversal_result, TraversalResult::ChildrenRendered) {
            rendered_children_indices.push(i);
        }
    }

    if are_children_rendered {
        for (i, child) in children.iter().enumerate() {
            // If this child's children are rendered, skip rendering this child.
            if rendered_children_indices.contains(&i) {
                continue;
            }
            // If this child is not renderable, skip rendering this child.
            if hidden_children_indices.contains(&i) {
                continue;
            }

            let handle = child.handle();
            let tile = match qt.qt.get_mut(handle) {
                Some(t) => t,
                None => unreachable!(),
            };
            spawn_tile_entity(command, tc, tile, handle);
        }

        qt.qt.get_mut(t.handle()).unwrap().previous_rendered_state =
            Some(RenderedState::RenderedChildren);
        if are_all_children_rendered {
            // This tile's children are rendered completely, so parent tile isn't rendered.
            return TraversalResult::ChildrenRendered;
        } else {
            // This tile's children are not rendered completely, so render parent tile as well.
            return TraversalResult::TileRenderedPartially;
        }
    }

    qt.qt.get_mut(t.handle()).unwrap().previous_rendered_state = None;

    if prepare_tile_resource(command, qt, buf, tiles, terrain_layer, t.handle()) {
        return TraversalResult::NotFound;
    }

    TraversalResult::TileRendered
}

#[allow(clippy::too_many_arguments)]
pub fn update_tiles(
    mut commands: Commands,
    mut qt: ResMut<TileQuadtree>,
    mut tc: ResMut<TileCacheManager>,
    mut buf: ResMut<BufferStore>,
    window: Res<Window>,
    tiles: Query<&TilesLayer>,
    terrain_layer: Query<&TerrainLayer>,
    camera: Query<(&CameraMarker, &Transform, &CameraFrustum)>,
    texture_fragment: Query<(&TileTextureFragmentMarker, &TextureFragment)>,
    terrain_data_requester: Query<(&TerrainDataRequesterMarker, &DataRequester)>,
    occluder: Query<&EllipsoidalOccluder>,
) {
    // TODO: Think how to support multiple terrain layer.(Is it possible?)
    let terrain_layer = terrain_layer.iter().next();

    let occluder = occluder.iter().next().unwrap();
    // TODO: Support multiple tiles
    for tiles in &tiles {
        for (_, camera, frustum) in &camera {
            let zero_tile = match qt.qt.zero() {
                Some(z) => z,
                None => {
                    qt.qt
                        .initialize_zero(&|(x, y, z)| Tile::new(TileXYZ { x, y, z }));
                    qt.qt
                        .zero()
                        .expect("Failed to initialize a level zero tile unexpectedly")
                }
            };
            match traverse_tile(
                &mut commands,
                tiles,
                &terrain_layer,
                zero_tile.as_ref(),
                &mut tc,
                &mut qt,
                &mut buf,
                camera,
                frustum,
                &texture_fragment,
                &terrain_data_requester,
                &window,
                &WGS84_32,
                occluder,
            ) {
                TraversalResult::TileRendered | TraversalResult::TileRenderedPartially => {
                    spawn_tile_entity(
                        &mut commands,
                        &mut tc,
                        qt.qt.get_mut(zero_tile.handle()).unwrap(),
                        zero_tile.handle(),
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
                    );
                }
                TraversalResult::ChildrenRendered => {}
                TraversalResult::Culled => {}
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
    rendered_tiles: Query<&RenderedTile, Changed<RenderedTile>>,
    terrain_data_requester: Query<(&TerrainDataRequesterMarker, &DataRequester)>,
    tile_layers: Query<&TilesLayer>,
    terrain_layer: Query<&TerrainLayer>,
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

    for rendered_tile in &rendered_tiles {
        let tile = qt.qt.get(rendered_tile.tile_handle).unwrap();

        let extent = tile.coords.extent();

        let map_url = tile_url(&tile_layer.url, &tile.coords);

        let terrain_req = match tile.terrain_data.as_ref() {
            Some(t) => t
                .data_requester_entity_id()
                .and_then(|e| terrain_data_requester.get(e).map_or(None, |v| Some(v.1))),
            None => None,
        };

        let should_render_terrain = terrain_layer.is_some()
            && terrain_req.map_or(false, |t| matches!(t.status, DataRequesterStatus::Success));

        let texture_fragment_entity_id = tile.texture_fragment_entity_id;

        if let Some(cached_mesh_handle) = &tile.cached_mesh_handle {
            let e = commands.spawn(MeshBundle {
                mesh: Mesh {
                    vertices: cached_mesh_handle.vertices,
                    indices: cached_mesh_handle.indices,
                    uvs: cached_mesh_handle.uvs,
                },
                material: Material {
                    color: tile_layer.color,
                    map_url: Some(map_url.clone()),
                    wireframe: tile_layer.wireframe,
                    texture_fragment: texture_fragment_entity_id,
                },
                object: ObjectBundle {
                    transform: Default::default(),
                    marker: Default::default(),
                },
            });
            if let Some(cache) = tc.rendered_tile_caches.get_mut(&rendered_tile.tile_handle) {
                cache.mesh_entity = Some(e.id());
            };
            continue;
        }

        let should_upsample_terrain =
            tile.is_upsamplable(&qt, &terrain_data_requester, &terrain_layer);

        if !should_render_terrain && !should_upsample_terrain {
            let triangles = tile_triangles_flat(WGS84_32, extent, tile_layer.segments, 0.);

            let vhandle = buf.new_f32(triangles.vertices.into_iter().flatten().collect());
            let ihandle = buf.new_u32(triangles.indices);
            let uvshandle = buf.new_f32(triangles.uvs.into_iter().flatten().collect());
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

            let e = commands.spawn(MeshBundle {
                mesh: Mesh {
                    vertices: vhandle,
                    indices: ihandle,
                    uvs: uvshandle,
                },
                material: Material {
                    color: tile_layer.color,
                    map_url: Some(map_url.clone()),
                    wireframe: tile_layer.wireframe,
                    texture_fragment: texture_fragment_entity_id,
                },
                object: ObjectBundle {
                    transform: Default::default(),
                    marker: Default::default(),
                },
            });

            if let Some(cache) = tc.rendered_tile_caches.get_mut(&rendered_tile.tile_handle) {
                cache.mesh_entity = Some(e.id());
            };
            continue;
        }

        let terrain_layer = terrain_layer.unwrap();

        if should_upsample_terrain {
            if let Some((vertices, uvs, upsampled)) = tile.upsample(WGS84_32, &qt, &buf) {
                let vhandle = buf.new_f32(vertices);
                let ihandle = buf.new_u32(upsampled.indices);
                let uvshandle = buf.new_f32(uvs);
                let heights_handle = buf.new_f32(upsampled.heights);
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

                let e = commands.spawn(MeshBundle {
                    mesh: Mesh {
                        vertices: vhandle,
                        indices: ihandle,
                        uvs: uvshandle,
                    },
                    material: Material {
                        color: terrain_layer.color,
                        map_url: Some(map_url.clone()),
                        wireframe: terrain_layer.wireframe,
                        texture_fragment: texture_fragment_entity_id,
                    },
                    object: ObjectBundle {
                        transform: Default::default(),
                        marker: Default::default(),
                    },
                });

                if let Some(cache) = tc.rendered_tile_caches.get_mut(&rendered_tile.tile_handle) {
                    cache.mesh_entity = Some(e.id());
                };
                let tile = qt.qt.get_mut(rendered_tile.tile_handle).unwrap();
                tile.terrain_data
                    .as_mut()
                    .expect("This line is invoked only in the tile has terrain")
                    .set_current_max_height(upsampled.max_height);

                continue;
            };
        }

        let terrain_req = terrain_req.unwrap();

        let bytes = match buf.get_u8(&terrain_req.handle) {
            Some(data) => data,
            None => unreachable!("This line should be invoked only when the terrain data is ready"),
        };
        let size = ((bytes.len() / 4) as f64).sqrt() as usize;
        let (triangles, max_height, heights) = tile_triangles_with_terrain(
            WGS84_32,
            extent,
            terrain_layer.segments,
            0.,
            bytes,
            size,
            size,
            &terrain_layer.elevation_decoder,
        );

        let vhandle = buf.new_f32(triangles.vertices.into_iter().flatten().collect());
        let ihandle = buf.new_u32(triangles.indices);
        let uvshandle = buf.new_f32(triangles.uvs.into_iter().flatten().collect());
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

        let e = commands.spawn(MeshBundle {
            mesh: Mesh {
                vertices: vhandle,
                indices: ihandle,
                uvs: uvshandle,
            },
            material: Material {
                color: terrain_layer.color,
                map_url: Some(map_url.clone()),
                wireframe: terrain_layer.wireframe,
                texture_fragment: texture_fragment_entity_id,
            },
            object: ObjectBundle {
                transform: Default::default(),
                marker: Default::default(),
            },
        });
        if let Some(cache) = tc.rendered_tile_caches.get_mut(&rendered_tile.tile_handle) {
            cache.mesh_entity = Some(e.id());
        };

        let tile = qt.qt.get_mut(rendered_tile.tile_handle).unwrap();
        tile.terrain_data
            .as_mut()
            .expect("This line is invoked only in the tile has terrain")
            .set_current_max_height(max_height);
    }
}

pub fn clear_caches(
    mut commands: Commands,
    mut tc: ResMut<TileCacheManager>,
    mut qt: ResMut<TileQuadtree>,
    mut buf: ResMut<BufferStore>,
    rendered_tiles: Query<(Entity, &RenderedTile)>,
    terrain_data_requester: Query<(&TerrainDataRequesterMarker, &DataRequester)>,
) {
    // Prevent blocking the frame by this deletion process
    for (rendered_tile_entity_id, rendered_tile) in rendered_tiles.iter() {
        let rendered_at = {
            let tile = qt.qt.get(rendered_tile.tile_handle).unwrap();
            tile.rendered_at
        };
        let cache = tc.rendered_tile_caches.get(&rendered_tile.tile_handle);
        // Remove unused mesh.
        if tc.rendered_frame != rendered_at && cache.is_some() {
            let cache = cache.unwrap();
            {
                if let Some(mesh_entity) = cache.mesh_entity {
                    commands.entity(mesh_entity).remove::<MeshBundle>();
                }
                commands
                    .entity(rendered_tile_entity_id)
                    .remove::<RenderedTile>();
                tc.rendered_tile_caches.remove(&rendered_tile.tile_handle);

                // To order the vector in oldest value first, the handle in last of the vector if it exists.
                if !tc
                    .cached_textures_tile_handles
                    .insert(rendered_tile.tile_handle)
                {
                    tc.cached_textures_tile_handles
                        .remove(&rendered_tile.tile_handle);
                    tc.cached_textures_tile_handles
                        .insert(rendered_tile.tile_handle);
                }
            }
        }
    }

    let mut removed_cached_tile_handler = vec![];

    // Prevent blocking the frame by this deletion process
    let max_deletion = 100;
    let max_cache_size = 100;

    // the cache overflowes the specified cache size
    if max_cache_size < tc.cached_textures_tile_handles.len() {
        for (i, tile_handle) in tc.cached_textures_tile_handles.iter().enumerate() {
            if i > max_deletion {
                break;
            }
            let (
                visited_at,
                data_requester_entity_id,
                texture_fragment_entity_id,
                cached_mesh_handle,
            ) = {
                let tile = qt.qt.get(*tile_handle).unwrap();
                (
                    tile.visited_at,
                    tile.terrain_data
                        .as_ref()
                        .and_then(|t| t.data_requester_entity_id()),
                    tile.texture_fragment_entity_id,
                    &tile.cached_mesh_handle,
                )
            };
            // FIXME: Need to improve this clearing caches process.
            // Each caches of texture are cleared in every 1000 frame,
            // but this is not suitable way, so need to think how to clear old cache.
            if tc.rendered_frame <= visited_at + 1000 {
                continue;
            }

            if let Some(cached_mesh) = cached_mesh_handle {
                buf.remove(&cached_mesh.vertices);
                buf.remove(&cached_mesh.indices);
                buf.remove(&cached_mesh.uvs);
            }
            if let Some(fragment) = texture_fragment_entity_id {
                commands
                    .entity(fragment)
                    .remove::<(TileTextureFragmentMarker, TextureFragment)>();
            }
            if let Some(e) = data_requester_entity_id {
                let data_requester = terrain_data_requester.get(e).unwrap();
                buf.remove(&data_requester.1.handle);
                commands
                    .entity(e)
                    .remove::<(TerrainDataRequesterMarker, DataRequester)>();
            }
            removed_cached_tile_handler.push(*tile_handle);
            qt.qt.remove(*tile_handle);
        }

        for i in removed_cached_tile_handler {
            tc.cached_textures_tile_handles.remove(&i);
        }
    }

    tc.is_updated_in_this_frame = false;
}

fn tile_url(s: &str, xyz: &TileXYZ) -> String {
    s.replace("{x}", &xyz.x.to_string())
        .replace("{y}", &xyz.y.to_string())
        .replace("{z}", &xyz.z.to_string())
}
