use bevy_ecs::prelude::*;
use navara_buffer_store::BufferStore;
use navara_component::{Deleted, OrderByDistance, Priority, Rendered};
use navara_core::{TileXYZ, WGS84_32};
use navara_data_requester::DataRequesterStatus;
use navara_frame::FrameManager;
use navara_geometry::tile_triangles_flat;
use navara_material::RasterTileInternalMaterial;
use navara_math::{FloatType, Transform, Vec3};

use navara_mesh::{CachedMeshHandle, Mesh, MeshBundle, ObjectBundle};
use navara_occluder::ellipsoidal_occluder::EllipsoidalOccluder;

use navara_camera::{CameraFrustum, CameraMarker};
use navara_tile_component::{
    CachedMartini, ChangedTileTerrainDataRequesterQuery, ChangedTileTextureFragmentQuery,
    RasterTile, RasterTileQuadtree, Tile, TileMeshMarker, TileTerrainDataRequesterQuery,
    TileTextureFragmentQuery,
};
use navara_window::Window;
use navara_worker::{
    construct_terrain_mesh::{
        ConstructTerrainMeshMarker, ConstructTerrainMeshParameters, ConstructTerrainMeshResult,
        ConstructTerrainMeshWorkerTaskBundle,
    },
    upsample_terrain_mesh::{
        UpsampleTerrainMeshMarker, UpsampleTerrainMeshParameters, UpsampleTerrainMeshResult,
        UpsampleTerrainMeshWorkerTaskBundle,
    },
    WorkerTaskCompleted,
};

use super::{
    event::MeshPreparedEvent,
    render::RenderedTile,
    tile_cache_manager::TileCacheManager,
    traverse::{prepare_tile_resource, spawn_tile_entity, traverse_tile, TraversalResult},
};

use navara_layer::{TerrainLayer, TilesLayer};

#[allow(clippy::too_many_arguments, clippy::type_complexity)]
pub fn update_tiles(
    mut commands: Commands,
    mut qt: ResMut<RasterTileQuadtree>,
    mut tc: ResMut<TileCacheManager>,
    mut buf: ResMut<BufferStore>,
    frame: Res<FrameManager>,
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
            tc.last_rendered_frame = frame.rendered_frame();

            let zero_tile = match qt.qt.zero() {
                Some(z) => z,
                None => {
                    qt.qt
                        .initialize_zero(&|(x, y, z)| RasterTile::new(TileXYZ { x, y, z }, 0.));
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
                &frame,
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
                        &frame,
                        qt.qt.get_mut(zero_tile.handle()).unwrap(),
                        zero_tile.handle(),
                    );
                }
                TraversalResult::NotFound => {
                    prepare_tile_resource(
                        &mut commands,
                        qt.qt.get_mut(zero_tile.handle()).unwrap(),
                        &mut buf,
                        tiles,
                        &terrain_layer,
                        zero_tile.handle(),
                        &mut tc,
                        &texture_fragment,
                        &terrain_data_requester,
                        Priority::Extreme,
                    );
                }
                _ => {}
            };
        }
    }
}

fn attach_rendered(commands: &mut Commands, e: Entity) {
    commands.entity(e).insert(Rendered);
}

#[allow(clippy::too_many_arguments, clippy::type_complexity)]
pub fn transfer_mesh(
    mut commands: Commands,
    mut buf: ResMut<BufferStore>,
    mut tc: ResMut<TileCacheManager>,
    mut qt: ResMut<RasterTileQuadtree>,
    cached_martini: Res<CachedMartini>,
    mut rendered_tiles: Query<
        (Entity, &mut RenderedTile, &OrderByDistance),
        Or<(Added<RenderedTile>, Without<Rendered>)>,
    >,
    texture_fragment: TileTextureFragmentQuery,
    terrain_data_requester: TileTerrainDataRequesterQuery,
    tile_layers: Query<&TilesLayer>,
    terrain_layer: Query<&TerrainLayer>,
    terrain_mesh_constructors: Query<&ConstructTerrainMeshResult, Without<Deleted>>,
    terrain_mesh_upsamplers: Query<&UpsampleTerrainMeshResult, Without<Deleted>>,
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

    for (rendered_tile_id, mut rendered_tile, order) in
        rendered_tiles.iter_mut().sort::<&OrderByDistance>()
    {
        let needs_update = rendered_tile.is_added()
            || rendered_tile
                .terrain_mesh_constructor
                .map_or(false, |c| terrain_mesh_constructors.contains(c))
            || rendered_tile
                .terrain_mesh_upsampler
                .map_or(false, |c| terrain_mesh_upsamplers.contains(c));
        if !needs_update {
            continue;
        }

        let tile = qt.qt.get(rendered_tile.tile_handle).unwrap();
        let is_root = tile.is_root();
        let scale = if is_root { 0.98 } else { 1. };
        let render_order = if is_root { -1 } else { 0 };

        let extent = tile.extent;

        let should_render_terrain = terrain_layer.is_some();
        let should_compute_normal_from_vertex =
            terrain_layer.map_or(false, |t| t.should_compute_normal_from_vertex);

        let texture_fragment_entity_id = tile.texture_fragment_entity_id;

        let mut appearance = tile_layer.appearance.as_ref().unwrap().clone();
        appearance.set_internal(RasterTileInternalMaterial {
            texture_fragment: texture_fragment_entity_id,
        });
        appearance.should_compute_normal_from_vertex = Some(should_compute_normal_from_vertex);

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

        let should_upsample_terrain = tile.should_upsampling(
            terrain_layer.map_or(1, |t| t.appearance.as_ref().unwrap().max_zoom),
        ) && tile.is_upsamplable(
            &qt,
            &texture_fragment,
            &terrain_data_requester,
            &terrain_layer,
        );

        if !should_render_terrain
            || (terrain_layer.map_or(false, |t| {
                t.appearance.as_ref().unwrap().min_zoom >= tile.coords.z
            }) || (!should_upsample_terrain && is_terrain_failed))
        {
            let triangles = tile_triangles_flat(
                WGS84_32,
                &extent,
                if is_root {
                    65
                } else {
                    tile_layer.appearance.as_ref().unwrap().segments
                },
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

            attach_rendered(&mut commands, rendered_tile_id);

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
                    material: appearance,
                    object: ObjectBundle {
                        transform: Transform::from_scale(Vec3::new(scale, scale, scale)),
                        marker: Default::default(),
                    },
                },
            ));

            if let Some(cache) = tc.rendered_tile_caches.get_mut(&rendered_tile.tile_handle) {
                cache.mesh_entity = Some(e.id());
            } else {
                panic!("Mesh duplication error");
            };
            continue;
        }

        let terrain_layer = terrain_layer.unwrap();

        fn postupdate_tile(tile: &mut RasterTile, max_height: FloatType, min_height: FloatType) {
            let terrain_data = tile
                .terrain_data
                .as_mut()
                .expect("This line is invoked only in the tile has terrain");
            terrain_data.set_current_max_height(max_height);
            terrain_data.set_current_min_height(min_height);
            tile.max_height = max_height;
            tile.aabb
                .update(tile.extent, min_height.min(0.), max_height)
        }

        if should_upsample_terrain {
            let terrain_mesh_upsampler_id = match rendered_tile.terrain_mesh_upsampler {
                Some(e) => e,
                None => {
                    let terrain_mesh_upsampler = commands
                        .spawn((
                            UpsampleTerrainMeshWorkerTaskBundle::new(
                                UpsampleTerrainMeshMarker,
                                UpsampleTerrainMeshParameters {
                                    tile_handle: rendered_tile.tile_handle,
                                },
                            ),
                            order.clone(),
                        ))
                        .id();
                    rendered_tile.terrain_mesh_upsampler = Some(terrain_mesh_upsampler);
                    continue;
                }
            };
            let terrain_mesh_upsampler =
                match terrain_mesh_upsamplers.get(terrain_mesh_upsampler_id) {
                    Ok(t) => t,
                    Err(_) => unreachable!(),
                };

            rendered_tile.terrain_mesh_upsampler = None;
            commands.entity(terrain_mesh_upsampler_id).insert(Deleted);

            let min_height = terrain_mesh_upsampler.min_height;
            let max_height = terrain_mesh_upsampler.max_height;

            let vhandle = terrain_mesh_upsampler.geometry.vertices;
            let ihandle = terrain_mesh_upsampler.geometry.indices;
            let uvshandle = terrain_mesh_upsampler.geometry.uvs;
            let heights_handle = terrain_mesh_upsampler.heights;
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

            attach_rendered(&mut commands, rendered_tile_id);

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
                    material: appearance,
                    object: ObjectBundle {
                        transform: Transform::from_scale(Vec3::new(scale, scale, scale)),
                        marker: Default::default(),
                    },
                },
            ));

            if let Some(cache) = tc.rendered_tile_caches.get_mut(&rendered_tile.tile_handle) {
                cache.mesh_entity = Some(e.id());
            } else {
                panic!("Mesh duplication error");
            };
            let tile = qt.qt.get_mut(rendered_tile.tile_handle).unwrap();
            postupdate_tile(tile, max_height, min_height);

            continue;
        }

        let terrain_req = terrain_req.unwrap();

        let martini_id = cached_martini
            .get(&terrain_layer.appearance.as_ref().unwrap().tile_size)
            .expect("It must be initialized when terrain layer is added");

        let terrain_mesh_constructor_id = match rendered_tile.terrain_mesh_constructor {
            Some(e) => e,
            None => {
                let terrain_mesh_constructor = commands
                    .spawn((
                        ConstructTerrainMeshWorkerTaskBundle::new(
                            ConstructTerrainMeshMarker,
                            ConstructTerrainMeshParameters {
                                martini_id: *martini_id,
                                bytes_handle: terrain_req.handle,
                                tile_handle: rendered_tile.tile_handle,
                            },
                        ),
                        order.clone(),
                    ))
                    .id();
                rendered_tile.terrain_mesh_constructor = Some(terrain_mesh_constructor);
                continue;
            }
        };
        let terrain_mesh_constructor =
            match terrain_mesh_constructors.get(terrain_mesh_constructor_id) {
                Ok(t) => t,
                Err(_) => unreachable!(),
            };

        rendered_tile.terrain_mesh_constructor = None;
        commands.entity(terrain_mesh_constructor_id).insert(Deleted);

        let min_height = terrain_mesh_constructor.min_height;
        let max_height = terrain_mesh_constructor.max_height;

        let vhandle = terrain_mesh_constructor.geometry.vertices;
        let ihandle = terrain_mesh_constructor.geometry.indices;
        let uvshandle = terrain_mesh_constructor.geometry.uvs;
        let heights_handle = terrain_mesh_constructor.heights;
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

        attach_rendered(&mut commands, rendered_tile_id);

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
                material: appearance,
                object: ObjectBundle {
                    transform: Transform::from_scale(Vec3::new(scale, scale, scale)),
                    marker: Default::default(),
                },
            },
        ));

        if let Some(cache) = tc.rendered_tile_caches.get_mut(&rendered_tile.tile_handle) {
            cache.mesh_entity = Some(e.id());
        } else {
            panic!("Mesh duplication error");
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

#[allow(clippy::type_complexity)]
pub fn handle_tile_worker_task_completed(
    mut tc: ResMut<TileCacheManager>,
    worker_tasks: Query<
        (),
        (
            Or<(
                With<ConstructTerrainMeshMarker>,
                With<UpsampleTerrainMeshMarker>,
            )>,
            With<WorkerTaskCompleted>,
        ),
    >,
) {
    if worker_tasks.is_empty() {
        return;
    }
    tc.is_updated_in_this_frame = true;
}

pub fn clear_caches(
    mut commands: Commands,
    mut tc: ResMut<TileCacheManager>,
    mut qt: ResMut<RasterTileQuadtree>,
    mut buf: ResMut<BufferStore>,
    mut rendered_tiles: Query<(Entity, &mut RenderedTile, &OrderByDistance)>,
    terrain_data_requester: TileTerrainDataRequesterQuery,
) {
    if !tc.is_updated_in_this_frame {
        tc.is_updated_in_this_frame = false;
        return;
    }
    tc.is_updated_in_this_frame = false;

    for (rendered_tile_entity_id, mut rendered_tile, _) in
        rendered_tiles.iter_mut().sort::<&OrderByDistance>().rev()
    {
        let visited_at = {
            let tile = qt.qt.get(rendered_tile.tile_handle).unwrap();
            tile.visited_at
        };

        if tc.last_rendered_frame <= visited_at + 1 {
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

        rendered_tile.destroy(&mut commands);
        qt.qt.remove(rendered_tile.tile_handle).unwrap().destroy(
            &mut commands,
            &mut buf,
            &terrain_data_requester,
        );
    }

    let mut removed_handles = vec![];
    for (handle, _requested) in tc.requested_tile_caches.iter() {
        let tile_handle = *handle;

        let visited_at = {
            let tile = qt.qt.get(tile_handle).unwrap();
            tile.visited_at
        };

        if tc.last_rendered_frame <= visited_at + 1 {
            continue;
        }

        qt.qt.remove(tile_handle).unwrap().destroy(
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
