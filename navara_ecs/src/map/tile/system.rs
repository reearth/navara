use bevy_ecs::prelude::*;
use bevy_log::info;
use bevy_math::Vec3;
use bevy_time::{Real, Time};
use instant::Duration;
use navara_core::{
    iter_tiles,
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
    occluder::ellipsoidal_occluder::EllipsoidalOccluder,
    texture_fragment::TextureFragmentStatus,
    utils::coord::{vec3_to_xyz, xyz_to_vec3},
    window::Window,
    BufferStore, DataRequester, Material, Mesh, MeshBundle, ObjectBundle, TextureFragment,
    Transform,
};

use super::{
    tile_cache_manager::{TileCache, TileCacheManager},
    Tile, TileHandle, TileQuadtree, Tiles,
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
    tiles: &Tiles,
    handle: TileHandle,
) -> bool {
    let tile = qt.qt.get_mut(handle).unwrap();
    if tile.texture_fragment_entity_id.is_some() {
        return false;
    }
    match tiles.tile_url.as_ref().map(|s| tile_url(s, &tile.coords)) {
        Some(url) => {
            let entity = commands.spawn(TextureFragment::new(url));
            tile.texture_fragment_entity_id = Some(entity.id());
        }
        None => return false,
    }
    return true;
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
    let error = (max_geometric_error * window.height)
        / (distance_from_camera * frustum.sse_denominator)
        / window.pixel_ratio;

    error
}

fn begine_traverse_tile(
    ellipsoid: &Ellipsoid<f32>,
    occluder: &EllipsoidalOccluder,
    _camera: &Transform,
    tile: &mut Tile,
) {
    // TODO: It might need to project AABB
    // tile.aabb.update_by_transform(camera);
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

    let mut positions = vec![];

    positions.push(xyz_to_vec3(
        ellipsoid.lle_to_xyz(
            LngLat {
                lng: extent.west,
                lat: extent.south,
            }
            .into(),
        ),
    ));
    positions.push(xyz_to_vec3(
        ellipsoid.lle_to_xyz(
            LngLat {
                lng: extent.east,
                lat: extent.south,
            }
            .into(),
        ),
    ));
    positions.push(xyz_to_vec3(
        ellipsoid.lle_to_xyz(
            LngLat {
                lng: extent.west,
                lat: extent.north,
            }
            .into(),
        ),
    ));
    positions.push(xyz_to_vec3(
        ellipsoid.lle_to_xyz(
            LngLat {
                lng: extent.east,
                lat: extent.north,
            }
            .into(),
        ),
    ));

    tile.occludee_point_in_scaled_space =
        occluder.compute_horizontal_culling_point(ellipsoid, center, positions);
}

pub(super) enum TraversalResult {
    TileRendered,
    ChildrenRendered,
    NotFound,
}

// This process works in the following steps.
// 1. Check if the AABB of the tile is within the camera's frustum.(Frustum culling)
// 2. Check horizon culling because the frustum culling is enough.
// 3. Check SSE is within max SSE.
// 4. If SSE works and the tile is loaded, the tile should be rendered.
// 5. On the other hand, if SSE works but the tile isn't loaded, the tile should be requested, not rendered.
// 6. If above steps aren't matched, traverse children.
// 7. If children couldn't find, use this tile instead.
fn traverse_tile(
    command: &mut Commands,
    tiles: &Tiles,
    t: &Box<dyn GeoSpacialQuadLeaf<usize>>,
    tc: &mut TileCacheManager,
    qt: &mut TileQuadtree,
    camera: &Transform,
    frustum: &CameraFrustum,
    texture_fragment: &Query<&TextureFragment>,
    window: &Window,
    ellipsoid: &Ellipsoid<f32>,
    occluder: &EllipsoidalOccluder,
    is_ancestor_renderable: bool,
) -> TraversalResult {
    let tile = match qt.qt.get_mut(t.handle()) {
        Some(tile) => tile,
        None => unreachable!(),
    };

    if tile.coords.z >= tiles.max_z {
        return TraversalResult::NotFound;
    }

    begine_traverse_tile(ellipsoid, occluder, camera, tile);

    let is_level_zero_tile = tile.is_coords_zero();

    let texture_fragment_status = tile
        .texture_fragment_entity_id
        .map(|e| texture_fragment.get(e).map(|t| &t.status));

    let is_texture_loaded =
        texture_fragment_status.map_or(false, |s| matches!(s, Ok(TextureFragmentStatus::Sucess)));

    let is_intersecting_with_frustum =
        is_level_zero_tile || intersect_with_camera_frustum(camera, frustum, &tile);
    if !is_intersecting_with_frustum && !is_ancestor_renderable {
        return TraversalResult::NotFound;
    }

    let is_visible = is_level_zero_tile
        || tile
            .occludee_point_in_scaled_space
            .map(|p| occluder.is_scaled_space_point_visible(p))
            .unwrap_or(false);
    if !is_visible && !is_ancestor_renderable {
        return TraversalResult::NotFound;
    }

    let max_sse = tiles.max_sse;

    let sse = calc_sse(camera, frustum, tile, window, ellipsoid);
    let meets_sse = sse < max_sse;

    let is_renderable = is_level_zero_tile || (is_intersecting_with_frustum && is_visible);

    if meets_sse {
        if is_texture_loaded {
            return TraversalResult::TileRendered;
        }
        request_texture_fragment(command, qt, tiles, t.handle());
        return TraversalResult::NotFound;
    }

    if is_renderable || is_ancestor_renderable {
        request_texture_fragment(command, qt, tiles, t.handle());
    }

    if !is_texture_loaded {
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

    let mut are_children_rendered = true;
    let mut rendered_children_indices = vec![];
    for (i, child) in children.iter().enumerate() {
        let traversal_result = traverse_tile(
            command,
            tiles,
            &child,
            tc,
            qt,
            camera,
            frustum,
            texture_fragment,
            window,
            ellipsoid,
            occluder,
            is_renderable,
        );
        if matches!(traversal_result, TraversalResult::NotFound) {
            are_children_rendered = false;
        }
        if matches!(traversal_result, TraversalResult::ChildrenRendered) {
            rendered_children_indices.push(i);
        }
    }

    if are_children_rendered {
        for (i, child) in children.iter().enumerate() {
            if rendered_children_indices.contains(&i) {
                continue;
            }

            let handle = child.handle();
            let tile = match qt.qt.get_mut(handle) {
                Some(t) => t,
                None => unreachable!(),
            };
            spawn_tile_entity(command, tc, tile, handle);
        }

        return TraversalResult::ChildrenRendered;
    }

    if request_texture_fragment(command, qt, tiles, t.handle()) {
        return TraversalResult::NotFound;
    }

    return TraversalResult::TileRendered;
}

// TODO: Support loading terrain dynamically
pub fn update_tiles(
    mut commands: Commands,
    mut qt: ResMut<TileQuadtree>,
    mut tc: ResMut<TileCacheManager>,
    window: Res<Window>,
    tiles: Query<&Tiles>,
    camera: Query<(&CameraMarker, &Transform, &CameraFrustum)>,
    texture_fragment: Query<&TextureFragment>,
    occluder: Query<&EllipsoidalOccluder>,
) {
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
                &zero_tile,
                &mut tc,
                &mut qt,
                camera,
                frustum,
                &texture_fragment,
                &window,
                &WGS84_32,
                occluder,
                false,
            ) {
                TraversalResult::TileRendered => {
                    spawn_tile_entity(
                        &mut commands,
                        &mut tc,
                        qt.qt.get_mut(zero_tile.handle()).unwrap(),
                        zero_tile.handle(),
                    );
                }
                TraversalResult::NotFound => {
                    request_texture_fragment(&mut commands, &mut qt, tiles, zero_tile.handle());
                }
                TraversalResult::ChildrenRendered => {}
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
    tile_layers: Query<&Tiles>,
) {
    if !tc.is_updated_in_this_frame {
        return;
    }

    // TODO: Support mutiple tile layers
    let tile_layer = match tile_layers.iter().next() {
        Some(tile) => tile,
        None => return,
    };

    for rendered_tile in &rendered_tiles {
        let tile = qt.qt.get(rendered_tile.tile_handle).unwrap();

        let extent = tile.coords.extent();
        if let Some(ref tiles_extent) = tile_layer.extent {
            if !tiles_extent.intersects(extent) {
                continue;
            }
        }

        let triangles =
            tile_triangles_flat(WGS84_32, extent, tile_layer.segments, tile_layer.height);

        let vhandle = buf.new_f32(triangles.vertices.into_iter().flatten().collect());
        let ihandle = buf.new_u32(triangles.indices);
        let uvshandle = buf.new_f32(triangles.uvs.into_iter().flatten().collect());

        let map_url = tile_layer
            .tile_url
            .as_ref()
            .map(|s| tile_url(s, &tile.coords));
        let terrain_url = tile_layer
            .terrain_url
            .as_ref()
            .map(|s| tile_url(s, &tile.coords));
        let mut e = commands.spawn(MeshBundle {
            mesh: Mesh {
                vertices: vhandle,
                indices: ihandle,
                uvs: uvshandle,
            },
            material: Material {
                color: tile_layer.color,
                map_url: map_url.clone(),
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

        // TODO: Support terrain
        // if let Some(tu) = terrain_url {
        //     e.insert(DataRequester::from_store(
        //         tu,
        //         &mut buf,
        //         Some(extent),
        //         map_url.clone(),
        //     ));
        // }
    }
}

pub fn end_update(
    mut commands: Commands,
    mut tc: ResMut<TileCacheManager>,
    qt: ResMut<TileQuadtree>,
    rendered_tiles: Query<&RenderedTile>,
) {
    if !tc.is_updated_in_this_frame {
        return;
    }

    for rendered_tile in &rendered_tiles {
        let (rendered_at, _data_requester_entity_id, texture_fragment_entity_id, coords) = {
            let tile = qt.qt.get(rendered_tile.tile_handle).unwrap();
            (
                tile.rendered_at,
                tile.data_requester_entity_id,
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
//     tiles: Query<&Tiles, Added<Tiles>>,
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

pub fn load_tiles(
    mut commands: Commands,
    mut buf: ResMut<BufferStore>,
    requests: Query<&DataRequester, Changed<DataRequester>>,
    tiles: Query<&Tiles>,
) {
    for req in requests.iter() {
        if !req.loaded {
            continue;
        };

        let ts: &Tiles = tiles
            .iter()
            .filter(|t| {
                iter_tiles(t.z).any(|xyz| {
                    t.terrain_url.as_ref().map(|s| tile_url(s, &xyz)) == Some(req.url.clone())
                })
            })
            .next()
            .unwrap();
        let bytes = buf.get_u8(&req.handle).unwrap();
        let size = ((bytes.len() / 4) as f64).sqrt() as usize;
        let triangles = tile_triangles_with_terrain(
            WGS84_32,
            req.extent.unwrap(),
            ts.segments,
            ts.height,
            bytes,
            size,
            size,
        );
        let vhandle = buf.new_f32(triangles.vertices.into_iter().flatten().collect());
        let ihandle = buf.new_u32(triangles.indices);
        let uvshandle = buf.new_f32(triangles.uvs.into_iter().flatten().collect());

        commands.spawn(MeshBundle {
            mesh: Mesh {
                vertices: vhandle,
                indices: ihandle,
                uvs: uvshandle,
            },
            material: Material {
                color: ts.color,
                map_url: req.map_url.clone(),
                wireframe: ts.wireframe,
                texture_fragment: None,
            },
            object: ObjectBundle {
                transform: Default::default(),
                marker: Default::default(),
            },
        });
    }
}

fn tile_url(s: &str, xyz: &TileXYZ) -> String {
    s.replace("{x}", &xyz.x.to_string())
        .replace("{y}", &xyz.y.to_string())
        .replace("{z}", &xyz.z.to_string())
}
