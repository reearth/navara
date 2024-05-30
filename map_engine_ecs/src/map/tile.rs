use bevy_ecs::prelude::*;
use bevy_math::Vec3;
use bevy_time::{Real, Time};
use instant::{Duration, Instant};
use map_engine_core::{
    iter_tiles,
    terrain::{
        get_ellipsoid_terrain_level_zero_maximum_geometric_error_f32,
        get_level_maximum_geometric_error_f32,
    },
    tile_geometry::{tile_triangles_flat, tile_triangles_with_terrain},
    Ellipsoid, Extent, LngLat, Radians, TileXYZ, LLE, WGS84_32,
};

use bevy_log::info;
use map_engine_quadtree::{GeoSpacialQuadLeaf, Quadtree};

use crate::{
    camera::{CameraFrustum, CameraMarker},
    primitives::Aabb,
    texture_fragment::TextureFragmentStatus,
    utils::coord::vec3_to_xyz,
    window::Window,
    BufferStore, DataRequester, Material, Mesh, MeshBundle, ObjectBundle, TextureFragment,
    Transform,
};

use super::{
    tile_bounding_region::TileBoundingReagion,
    tile_cache_manager::{TileCache, TileCacheManager},
};

pub(super) type TileHandle = u64;

#[derive(Debug, Clone, PartialEq, Default, Component)]
pub struct Tiles {
    pub tile_url: Option<String>,
    pub terrain_url: Option<String>,
    pub z: usize,
    pub segments: usize,
    pub height: f32,
    pub extent: Option<Extent<f32, Radians>>,
    pub color: u32,
    pub max_sse: f32,
    pub wireframe: bool,
}

#[derive(Debug, Default)]
pub struct Tile {
    pub coords: TileXYZ,
    pub aabb: Aabb,
    pub bounding_reagion: Option<TileBoundingReagion<f32>>,
    pub(super) rendered_at: Option<Instant>,
    pub(super) data_requester_entity_id: Option<Entity>,
    pub(super) texture_fragment_entity_id: Option<Entity>,
    pub(super) mesh_entity_id: Option<Entity>,
}

impl Tile {
    pub(super) fn new(coords: TileXYZ) -> Self {
        let extent = coords.extent();
        Self {
            coords,
            aabb: Aabb::from_lle_f32(
                LLE::from(LngLat {
                    lng: extent.west,
                    lat: extent.south,
                }),
                LLE::from(LngLat {
                    lng: extent.east,
                    lat: extent.north,
                }),
            ),
            bounding_reagion: Some(TileBoundingReagion::from_extent_f32(extent, WGS84_32)),
            ..Default::default()
        }
    }
}

pub type TileQuadtree = Quadtree<usize, Tile>;

#[derive(Component)]
pub(super) struct RenderedTile {
    tile_handle: TileHandle,
}

pub(super) enum TraversalResult {
    TileRendered,
    ChildrenRendered,
    NotFound,
}

// We should use entity to store the rendered tile, because the Bevy's entity is extensible.
fn spawn_tile_entity(
    commands: &mut Commands,
    tc: &mut TileCacheManager,
    time: &Time<Real>,
    tile: &mut Tile,
    tile_handle: TileHandle,
) {
    tile.rendered_at = time.last_update();
    tc.is_updated_in_this_frame = true;

    if let Some(cache) = tc.caches.get_mut(&tile_handle) {
        cache.rendered_at = tile.rendered_at;
        return;
    }

    let entity = commands.spawn(RenderedTile { tile_handle });
    tc.caches.insert(
        tile_handle,
        TileCache {
            mesh_entity: None,
            tile_entity: entity.id(),
            rendered_at: tile.rendered_at,
        },
    );
}

fn request_texture_fragment(
    commands: &mut Commands,
    qt: &mut TileQuadtree,
    tiles: &Tiles,
    handle: TileHandle,
) {
    let tile = qt.qt.get_mut(handle).unwrap();
    match tiles.tile_url.as_ref().map(|s| tile_url(s, &tile.coords)) {
        Some(url) => {
            info!("Texture fragment is requested: {}", &url);
            let entity = commands.spawn(TextureFragment::new(url));
            tile.texture_fragment_entity_id = Some(entity.id());
        }
        None => {}
    }
}

// FIXME: This is the calculation just to make it work. We need to use the frutsum.
// fn intersect_with_camera(camera: &Transform, t: &Tile) -> bool {
//     // TODO: Get this from parameter
//     let ellipsoid = WGS84_32;
//     let position = camera.transform_point(Vec3::ZERO);
//     let forward = camera.forward();
//     let up = camera.up();
//     let right = forward.cross(up);
//     let right = right.normalize();
//     let up = up.normalize();

//     let camera_rect_size = 10000.;

//     let camera_rect_min = (position - (camera_rect_size * right)) - (camera_rect_size * up);
//     let camera_rect_max = (position + (camera_rect_size * right)) + (camera_rect_size * up);
//     let camera_rect_min_lle = ellipsoid.xyz_to_lle(XYZ {
//         x: Meters::new(camera_rect_min.x),
//         y: Meters::new(camera_rect_min.y),
//         z: Meters::new(camera_rect_min.z),
//     });
//     let camera_rect_max_lle = ellipsoid.xyz_to_lle(XYZ {
//         x: Meters::new(camera_rect_max.x),
//         y: Meters::new(camera_rect_max.y),
//         z: Meters::new(camera_rect_max.z),
//     });

//     let camera_extent: Extent<f32, Radians> =
//         Extent::from_points(camera_rect_min_lle.into(), camera_rect_max_lle.into());

//     camera_extent.intersects(t.coords.extent())
// }

fn intersect_with_camera_frustum(_camera: &Transform, frustum: &CameraFrustum, t: &Tile) -> bool {
    frustum.interseciton_with_aabb(&t.aabb)
}

// FIXME: This is the calculation just to make it work. We should make correct calculation by SSE or something.
// fn next_z(camera: &Transform, t: &Tile, max_z: usize) -> usize {
//     let position = camera.transform_point(Vec3::ZERO);

//     let scale = 100.;
//     let r: f32 = EARTH_RADIUS_F32;
//     let scaled_r = r + scale;

//     let camera_distance_from_center = position.distance(Vec3::ZERO);

//     let tile_distance_from_camera = position.distance(t.aabb.center);

//     let z = (((max_z as f32) * (scaled_r / camera_distance_from_center)).floor() - 7.)
//         .max(0.)
//         .min(max_z as f32) as usize;

//     // info!("ZOOM LEVEL: {}", z);

//     z
// }

fn calc_sse(
    camera: &Transform,
    frustum: &CameraFrustum,
    t: &Tile,
    window: &Window,
    ellipsoid: Ellipsoid<f32>,
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

// This process works in the following steps.
// 1. Check if a corner of camera's frustum is inside of the tile.
// 2. Check SSE
// 3. If SSE works and the tile is loaded, the tile should be rendered.
// 4. In the other hand, if SSE works but the tile is loaded, the tile should be requested, not rendered.
// 5. If above steps aren't matched, traverse children.
// 6. If children couldn't find, use this tile instead.
fn traverse_tile(
    command: &mut Commands,
    tiles: &Tiles,
    t: &Box<dyn GeoSpacialQuadLeaf<usize>>,
    time: &Time<Real>,
    tc: &mut TileCacheManager,
    qt: &mut TileQuadtree,
    camera: &Transform,
    frustum: &CameraFrustum,
    texture_fragment: &Query<&TextureFragment>,
    window: &Window,
    ellipsoid: Ellipsoid<f32>,
    is_ancestor_renderable: bool,
) -> TraversalResult {
    let tile = match qt.qt.get(t.handle()) {
        Some(tile) => tile,
        None => return TraversalResult::NotFound,
    };
    let is_level_zero_tile = tile.coords.x == 0 && tile.coords.y == 0 && tile.coords.z == 0;

    let texture_fragment_status = tile
        .texture_fragment_entity_id
        .map(|e| texture_fragment.get(e).map(|t| &t.status));

    // FIXME: Need to handle failded request
    let is_texture_loaded =
        texture_fragment_status.map_or(false, |s| matches!(s, Ok(TextureFragmentStatus::Sucess)));

    let is_camera_intersection_tile =
        is_level_zero_tile || intersect_with_camera_frustum(camera, frustum, &tile);
    if !is_camera_intersection_tile && !is_ancestor_renderable {
        return TraversalResult::NotFound;
    }

    let max_sse = tiles.max_sse;
    let sse = calc_sse(camera, frustum, tile, window, ellipsoid);
    let meets_sse = sse <= max_sse;

    let is_renderable = is_camera_intersection_tile;

    if meets_sse {
        if is_texture_loaded {
            return TraversalResult::TileRendered;
        }
        if tile.texture_fragment_entity_id.is_none() {
            request_texture_fragment(command, qt, tiles, t.handle());
        }
        return TraversalResult::NotFound;
    }

    if is_renderable || is_ancestor_renderable {
        if tile.texture_fragment_entity_id.is_none() {
            request_texture_fragment(command, qt, tiles, t.handle());
        }
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
    for child in &children {
        if !matches!(
            traverse_tile(
                command,
                tiles,
                &child,
                time,
                tc,
                qt,
                camera,
                frustum,
                texture_fragment,
                window,
                ellipsoid,
                is_renderable,
            ),
            TraversalResult::TileRendered
        ) {
            are_children_rendered = false;
        }
    }

    if are_children_rendered {
        for child in &children {
            let handle = child.handle();
            let tile = match qt.qt.get_mut(handle) {
                Some(t) => t,
                None => {
                    break;
                }
            };
            spawn_tile_entity(command, tc, time, tile, handle);
        }

        return TraversalResult::ChildrenRendered;
    }

    let tile = match qt.qt.get(t.handle()) {
        Some(tile) => tile,
        None => return TraversalResult::NotFound,
    };

    if tile.texture_fragment_entity_id.is_none() {
        request_texture_fragment(command, qt, tiles, t.handle());
        return TraversalResult::NotFound;
    }

    return TraversalResult::TileRendered;
}

// TODO: Support loading terrain dynamically
pub(super) fn update_tiles(
    mut commands: Commands,
    mut qt: ResMut<TileQuadtree>,
    mut tc: ResMut<TileCacheManager>,
    time: Res<Time<Real>>,
    window: Res<Window>,
    tiles: Query<&Tiles>,
    camera: Query<(&CameraMarker, &Transform, &CameraFrustum), Changed<Transform>>,
    texture_fragment: Query<&TextureFragment>,
) {
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
                &time,
                &mut tc,
                &mut qt,
                camera,
                frustum,
                &texture_fragment,
                &window,
                WGS84_32,
                false,
            ) {
                TraversalResult::TileRendered => {
                    spawn_tile_entity(
                        &mut commands,
                        &mut tc,
                        &time,
                        qt.qt.get_mut(zero_tile.handle()).unwrap(),
                        zero_tile.handle(),
                    );
                }
                TraversalResult::NotFound => {
                    let tile = match qt.qt.get(zero_tile.handle()) {
                        Some(tile) => tile,
                        None => continue,
                    };

                    if tile.texture_fragment_entity_id.is_none() {
                        request_texture_fragment(&mut commands, &mut qt, tiles, zero_tile.handle());
                    }
                }
                TraversalResult::ChildrenRendered => {}
            };
        }
    }
}

pub(super) fn transfer_mesh(
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

        info!("Rendered {:?}", tile.coords);

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

pub(super) fn end_update(
    mut commands: Commands,
    mut tc: ResMut<TileCacheManager>,
    mut qt: ResMut<TileQuadtree>,
    time: Res<Time<Real>>,
    rendered_tiles: Query<&RenderedTile>,
) {
    if !tc.is_updated_in_this_frame {
        return;
    }

    for rendered_tile in &rendered_tiles {
        let (rendered_at, _data_requester_entity_id, texture_fragment_entity_id) = {
            let tile = qt.qt.get(rendered_tile.tile_handle).unwrap();
            (
                tile.rendered_at,
                tile.data_requester_entity_id,
                tile.texture_fragment_entity_id,
            )
        };
        match (
            rendered_at,
            time.last_update(),
            tc.caches.get(&rendered_tile.tile_handle),
        ) {
            (Some(tile_rendered_at), Some(last_updated_at), Some(cache)) => {
                // Remove unused mesh.
                if last_updated_at.duration_since(tile_rendered_at) >= Duration::from_millis(1) {
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
                if last_updated_at.duration_since(tile_rendered_at) >= Duration::from_millis(1000) {
                    {
                        qt.qt
                            .get_mut(rendered_tile.tile_handle)
                            .map(|t| t.texture_fragment_entity_id = None);
                        if let Some(fragment) = texture_fragment_entity_id {
                            commands.entity(fragment).remove::<TextureFragment>();
                        }
                    }

                    // TODO: Handle the data requester as well.
                }
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
        info!("{:?}", ts);
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
