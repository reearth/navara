use bevy_ecs::prelude::*;
use bevy_math::Vec3;
use navara_core::{
    terrain::{
        get_ellipsoid_terrain_level_zero_maximum_geometric_error_f32,
        get_level_maximum_geometric_error_f32,
    },
    tile_geometry::{tile_triangles_flat, tile_triangles_with_terrain},
    Ellipsoid, LngLat, TileXYZ, WGS84_32,
};

use navara_quadtree::GeoSpacialQuadLeaf;

use crate::{
    camera::{CameraFrustum, CameraMarker},
    map::terrain::layer::TerrainLayer,
    occluder::ellipsoidal_occluder::EllipsoidalOccluder,
    utils::coord::{vec3_to_xyz, xyz_to_vec3},
    window::Window,
    BufferStore, DataRequester, DataRequesterStatus, Material, Mesh, MeshBundle, ObjectBundle,
    TextureFragment, Transform,
};

use super::{
    layer::TilesLayer,
    terrain::TerrainDataRequesterMarker,
    tile_cache_manager::{TileCache, TileCacheManager},
    Tile, TileHandle, TileQuadtree, TileTextureFragmentMarker,
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

    if let Some(cache) = tc.caches.get_mut(&tile_handle) {
        cache.rendered_at = tc.rendered_frame;
        return;
    }

    let entity = commands.spawn(RenderedTile { tile_handle });
    tc.caches.insert(
        tile_handle,
        TileCache {
            mesh_entity: None,
            tile_entity: entity.id(),
            rendered_at: tc.rendered_frame,
        },
    );
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
    if tile.terrain_data.data_requester_entity_id.is_some() {
        return false;
    }
    // FIXME: The terrain should be the layer, not part of the tile.
    match terrain_layer.map(|t| tile_url(&t.url, &tile.coords)) {
        Some(url) => {
            let entity = commands.spawn((
                TerrainDataRequesterMarker,
                DataRequester::from_store(url, buf),
            ));
            tile.terrain_data.data_requester_entity_id = Some(entity.id());
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
) -> f32 {
    let max_geometric_error = get_level_maximum_geometric_error_f32(
        t.coords.z,
        // TODO: Store the result of the level zero maximum geometric error to avoid too many caclulation.
        get_ellipsoid_terrain_level_zero_maximum_geometric_error_f32(ellipsoid),
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

// TODO: Terrain support
fn update_tile_occludee_point(
    ellipsoid: &Ellipsoid<f32>,
    occluder: &EllipsoidalOccluder,
    tile: &mut Tile,
) {
    let extent = tile.coords.extent();
    let center = tile.aabb.center;

    let positions = vec![
        xyz_to_vec3(
            ellipsoid.lle_to_xyz(
                LngLat {
                    lng: extent.west,
                    lat: extent.south,
                }
                .into(),
            ),
        ),
        xyz_to_vec3(
            ellipsoid.lle_to_xyz(
                LngLat {
                    lng: extent.east,
                    lat: extent.south,
                }
                .into(),
            ),
        ),
        xyz_to_vec3(
            ellipsoid.lle_to_xyz(
                LngLat {
                    lng: extent.west,
                    lat: extent.north,
                }
                .into(),
            ),
        ),
        xyz_to_vec3(
            ellipsoid.lle_to_xyz(
                LngLat {
                    lng: extent.east,
                    lat: extent.north,
                }
                .into(),
            ),
        ),
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

    let is_tile_ready = tile.is_ready(qt, texture_fragment, terrain_data_requester);

    let is_rendered_last_frame = tc.caches.get(&t.handle()).is_some();

    let is_intersecting_with_frustum = intersect_with_camera_frustum(camera, frustum, tile);
    if !is_intersecting_with_frustum {
        return TraversalResult::Culled;
    }

    let is_visible = tile
        .occludee_point_in_scaled_space
        .map(|p| occluder.is_scaled_space_point_visible(p))
        .unwrap_or(true);
    if !is_visible {
        return TraversalResult::Culled;
    }

    let max_sse = tiles.max_sse;

    let sse = calc_sse(camera, frustum, tile, window, ellipsoid);
    let meets_sse = sse < max_sse;

    let is_renderable = is_rendered_last_frame || is_tile_ready;

    if meets_sse {
        if is_renderable {
            return TraversalResult::TileRendered;
        }
        prepare_tile_resource(command, qt, buf, tiles, terrain_layer, t.handle());
    } else {
        prepare_tile_resource(command, qt, buf, tiles, terrain_layer, t.handle());
    }

    if !is_tile_ready {
        return TraversalResult::NotFound;
    }

    let children = match qt.qt.children(t.coords()) {
        Some(c) => c,
        None => {
            qt.qt
                .initialize_children(t.coords(), &|(x, y, z)| Tile::new(TileXYZ { x, y, z }));
            qt.qt.children(t.coords()).unwrap()
        }
    };

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

        if are_all_children_rendered {
            // This tile's children are rendered completely, so parent tile isn't rendered.
            return TraversalResult::ChildrenRendered;
        } else {
            // This tile's children are not rendered completely, so render parent tile as well.
            return TraversalResult::TileRenderedPartially;
        }
    }

    if prepare_tile_resource(command, qt, buf, tiles, terrain_layer, t.handle()) {
        return TraversalResult::NotFound;
    }

    TraversalResult::TileRendered
}

// TODO: Support loading terrain dynamically
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

pub fn transfer_mesh(
    mut commands: Commands,
    mut buf: ResMut<BufferStore>,
    mut tc: ResMut<TileCacheManager>,
    qt: Res<TileQuadtree>,
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

        let terrain_req = tile
            .terrain_data
            .data_requester_entity_id
            .map_or(None, |e| {
                terrain_data_requester.get(e).map_or(None, |v| Some(v.1))
            });

        let should_render_terrain = terrain_layer.is_some()
            && terrain_req.map_or(false, |t| matches!(t.status, DataRequesterStatus::Success));

        if !should_render_terrain {
            let triangles = tile_triangles_flat(WGS84_32, extent, tile_layer.segments, 0.);

            let vhandle = buf.new_f32(triangles.vertices.into_iter().flatten().collect());
            let ihandle = buf.new_u32(triangles.indices);
            let uvshandle = buf.new_f32(triangles.uvs.into_iter().flatten().collect());

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
                    texture_fragment: tile.texture_fragment_entity_id,
                },
                object: ObjectBundle {
                    transform: Default::default(),
                    marker: Default::default(),
                },
            });

            if let Some(cache) = tc.caches.get_mut(&rendered_tile.tile_handle) {
                cache.mesh_entity = Some(e.id());
            };
            continue;
        }

        let terrain_layer = terrain_layer.unwrap();
        let terrain_req = terrain_req.unwrap();

        let bytes = buf.get_u8(&terrain_req.handle).unwrap();
        let size = ((bytes.len() / 4) as f64).sqrt() as usize;
        let triangles = tile_triangles_with_terrain(
            WGS84_32,
            extent,
            terrain_layer.segments,
            0.,
            bytes,
            size,
            size,
        );
        let vhandle = buf.new_f32(triangles.vertices.into_iter().flatten().collect());
        let ihandle = buf.new_u32(triangles.indices);
        let uvshandle = buf.new_f32(triangles.uvs.into_iter().flatten().collect());

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
                texture_fragment: tile.texture_fragment_entity_id,
            },
            object: ObjectBundle {
                transform: Default::default(),
                marker: Default::default(),
            },
        });
        if let Some(cache) = tc.caches.get_mut(&rendered_tile.tile_handle) {
            cache.mesh_entity = Some(e.id());
        };
    }
}

pub fn clear_caches(
    mut commands: Commands,
    mut tc: ResMut<TileCacheManager>,
    qt: ResMut<TileQuadtree>,
    rendered_tiles: Query<&RenderedTile>,
) {
    if !tc.is_updated_in_this_frame {
        return;
    }

    // Prevent blocking the frame by this deletion process
    let max_deletion = 10000;
    for (count, rendered_tile) in rendered_tiles.iter().enumerate() {
        if count > max_deletion {
            break;
        }
        let (rendered_at, _data_requester_entity_id, _texture_fragment_entity_id, _coords) = {
            let tile = qt.qt.get(rendered_tile.tile_handle).unwrap();
            (
                tile.rendered_at,
                tile.terrain_data.data_requester_entity_id,
                tile.texture_fragment_entity_id,
                tile.coords,
            )
        };
        match (
            rendered_at,
            tc.rendered_frame,
            tc.caches.get(&rendered_tile.tile_handle),
        ) {
            (tile_rendered_at, rendered_frame, Some(cache)) => {
                // Remove unused mesh.
                if rendered_frame != tile_rendered_at {
                    {
                        if let Some(mesh_entity) = cache.mesh_entity {
                            commands.entity(mesh_entity).remove::<MeshBundle>();
                        }
                        commands.entity(cache.tile_entity).remove::<RenderedTile>();
                        tc.caches.remove(&rendered_tile.tile_handle);
                    }
                }

                // FIXME: This process deletes all cached textures by a second, but we should keep the cache until
                // the cache overflowes the specified cache size
                // if last_updated_at.duration_since(tile_rendered_at) >= Duration::from_millis(1000) {
                //     {
                // qt.qt
                //     .get_mut(rendered_tile.tile_handle)
                //     .map(|t| t.texture_fragment_entity_id = None);
                // if let Some(fragment) = texture_fragment_entity_id {
                //     commands.entity(fragment).remove::<TextureFragment>();
                // }
                // }

                // TODO: Handle the data requester as well.
                // }
            }
            _ => continue,
        }
    }

    tc.is_updated_in_this_frame = false;
}

// pub fn update_tiles(
//     mut commands: Commands,
//     mut buf: ResMut<BufferStore>,
//     mut qt: ResMut<TileQuadtree>,
//     time: Res<Time<Real>>,
//     tiles: Query<&TileLayer, Added<Tiles>>,
//     camera_transform: Query<(&CameraMarker, &Transform), Changed<Transform>>,
// ) {
//     for tiles in tiles.iter() {
//         for xyz in iter_tiles(tiles.z) {
//             let extent = xyz.extent();
//             if let Some(ref tiles_extent) = tiles.extent {
//                 if !tiles_extent.intersects(extent) {
//                     continue;
//                 }
//             }

//             let triangles = tile_triangles_flat(WGS84_32, extent, tiles.segments, tiles.height);

//             let vhandle = buf.new_f32(triangles.vertices.into_iter().flatten().collect());
//             let ihandle = buf.new_u32(triangles.indices);
//             let uvshandle = buf.new_f32(triangles.uvs.into_iter().flatten().collect());

//             let map_url = tiles.tile_url.as_ref().map(|s| tile_url(s, &xyz));
//             let terrain_url = tiles.terrain_url.as_ref().map(|s| tile_url(s, &xyz));
//             let mut e = commands.spawn(MeshBundle {
//                 mesh: Mesh {
//                     vertices: vhandle,
//                     indices: ihandle,
//                     uvs: uvshandle,
//                 },
//                 material: Material {
//                     color: tiles.color,
//                     map_url: map_url.clone(),
//                     wireframe: tiles.wireframe,
//                 },
//                 object: ObjectBundle {
//                     transform: Default::default(),
//                     marker: Default::default(),
//                 },
//             });

//             if let Some(tu) = terrain_url {
//                 e.insert(DataRequester::from_store(
//                     tu,
//                     &mut buf,
//                     Some(extent),
//                     map_url.clone(),
//                 ));
//             }
//         }
//     }
// }

// pub fn load_tiles(
//     mut commands: Commands,
//     mut buf: ResMut<BufferStore>,
//     requests: Query<&DataRequester, Changed<DataRequester>>,
//     tiles: Query<&TileLayer>,
// ) {
//     for req in requests.iter() {
//         if !req.loaded {
//             continue;
//         };

//         let ts: &TileLayer = tiles
//             .iter()
//             .filter(|t| {
//                 iter_tiles(t.z).any(|xyz| {
//                     t.terrain_url.as_ref().map(|s| tile_url(s, &xyz)) == Some(req.url.clone())
//                 })
//             })
//             .next()
//             .unwrap();
//         let bytes = buf.get_u8(&req.handle).unwrap();
//         let size = ((bytes.len() / 4) as f64).sqrt() as usize;
//         let triangles = tile_triangles_with_terrain(
//             WGS84_32,
//             req.extent.unwrap(),
//             ts.segments,
//             ts.height,
//             bytes,
//             size,
//             size,
//         );
//         let vhandle = buf.new_f32(triangles.vertices.into_iter().flatten().collect());
//         let ihandle = buf.new_u32(triangles.indices);
//         let uvshandle = buf.new_f32(triangles.uvs.into_iter().flatten().collect());

//         commands.spawn(MeshBundle {
//             mesh: Mesh {
//                 vertices: vhandle,
//                 indices: ihandle,
//                 uvs: uvshandle,
//             },
//             material: Material {
//                 color: ts.color,
//                 map_url: req.map_url.clone(),
//                 wireframe: ts.wireframe,
//                 texture_fragment: None,
//             },
//             object: ObjectBundle {
//                 transform: Default::default(),
//                 marker: Default::default(),
//             },
//         });
//     }
// }

fn tile_url(s: &str, xyz: &TileXYZ) -> String {
    s.replace("{x}", &xyz.x.to_string())
        .replace("{y}", &xyz.y.to_string())
        .replace("{z}", &xyz.z.to_string())
}
