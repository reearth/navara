use bevy_ecs::prelude::*;
use navara_buffer_store::BufferStore;
use navara_component::{Deleted, Order, OrderByDistance, Priority, Rendered};
use navara_core::{TileXYZ, WGS84_32};
use navara_data_requester::DataRequesterStatus;
use navara_fog::Fog;
use navara_frame::FrameManager;
use navara_geometry::{tile_triangles_flat, uv_transform};
use navara_material::RasterTileInternalMaterial;
use navara_math::{FloatType, Transform, Vec3};

use navara_mesh::{CachedMeshHandle, Mesh, MeshBundle, ObjectBundle};
use navara_occluder::ellipsoidal_occluder::EllipsoidalOccluder;

use navara_camera::{CameraFrustum, CameraMarker};
use navara_tile_component::{
    CachedMartini, ChangedTileTerrainDataRequesterQuery, ChangedTileTextureFragmentQuery,
    RasterTile, RasterTileQuadtree, TerrainInformation, TerrainInformationQuadtree, Tile,
    TileMeshMarker, TileTerrainDataRequesterQuery, TileTextureFragmentQuery,
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

use crate::texture_fragment::request_texture_fragment;

use super::{
    event::MeshPreparedEvent,
    render::RenderedTile,
    tile_cache_manager::TileCacheManager,
    traverse::{prepare_tile_resource, spawn_tile_entity, traverse_tile, TraversalResult},
};

use navara_layer::{
    DeleteRasterTileLayerMarker, TerrainLayer, TilesLayer, UpdateRasterTileLayerMarker,
};

#[allow(clippy::too_many_arguments, clippy::type_complexity)]
pub fn update_tiles(
    mut commands: Commands,
    mut qt: ResMut<RasterTileQuadtree>,
    mut tc: ResMut<TileCacheManager>,
    mut buf: ResMut<BufferStore>,
    frame: Res<FrameManager>,
    window: Res<Window>,
    mut tiles_set: ParamSet<(Query<(&TilesLayer, &Order)>, Query<(), Added<TilesLayer>>)>,
    terrain_layer: Query<&TerrainLayer>,
    camera: Query<(Ref<Transform>, &CameraFrustum), With<CameraMarker>>,
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
    fogs: Query<&Fog>,
) {
    let is_texture_fragment_changed = !changed_texture_fragment.is_empty();
    let is_data_requester_changed = !changed_terrain_data_requester.is_empty();
    let is_mesh_changed = !meshes_set.p1().is_empty();
    let is_tile_layer_added = !tiles_set.p1().is_empty();

    let mut meshes = meshes_set.p0();

    // TODO: Think how to support multiple terrain layer.(Is it possible?)
    let terrain_layer = terrain_layer.iter().next();

    let occluder = occluder.iter().next().unwrap();

    let fog = fogs.single();
    let (camera, frustum) = camera.single();

    let needs_update = is_texture_fragment_changed
        || is_data_requester_changed
        || is_mesh_changed
        || tc.is_updated_in_this_frame
        || camera.is_added()
        || camera.is_changed()
        || is_tile_layer_added;
    if !needs_update {
        return;
    }

    let tiles = &tiles_set.p0();

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
    let zero_tile_handle = zero_tile.handle();

    let is_texture_ready = qt
        .qt
        .get_mut(zero_tile_handle)
        .unwrap()
        .is_texture_ready(&texture_fragment);

    match traverse_tile(
        &mut commands,
        tiles,
        &terrain_layer,
        zero_tile_handle,
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
        fog,
        false,
        is_texture_ready.then_some(zero_tile_handle),
    ) {
        TraversalResult::TileRendered => {
            spawn_tile_entity(
                &mut commands,
                &mut tc,
                &frame,
                qt.qt.get_mut(zero_tile_handle).unwrap(),
                zero_tile_handle,
                None,
            );
            if tc.is_rendered_tile_prepared(&zero_tile_handle) {
                tc.activate_rendered_tile(&zero_tile_handle, &mut meshes, true);
            }
        }
        TraversalResult::NotFound => {
            prepare_tile_resource(
                &mut commands,
                &mut qt,
                &mut buf,
                &terrain_layer,
                zero_tile_handle,
                &mut tc,
                tiles,
                &texture_fragment,
                &terrain_data_requester,
                Priority::Extreme,
            );
            let tile = qt.qt.get_mut(zero_tile_handle).unwrap();
            request_texture_fragment(
                &mut commands,
                tile,
                tiles,
                zero_tile_handle,
                &texture_fragment,
                Priority::High,
            );
        }
        TraversalResult::ChildrenMeshesPrepared => {
            tc.activate_rendered_tile(&zero_tile_handle, &mut meshes, false);
        }
        _ => {}
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
    mut terrain_qt: ResMut<TerrainInformationQuadtree>,
    cached_martini: Res<CachedMartini>,
    mut rendered_tiles: Query<
        (Entity, &mut RenderedTile, &OrderByDistance),
        Or<(Added<RenderedTile>, Without<Rendered>)>,
    >,
    texture_fragment: TileTextureFragmentQuery,
    terrain_data_requester: TileTerrainDataRequesterQuery,
    tile_layers: Query<(&TilesLayer, &Order)>,
    terrain_layer: Query<&TerrainLayer>,
    terrain_mesh_constructors: Query<&ConstructTerrainMeshResult, Without<Deleted>>,
    terrain_mesh_upsamplers: Query<&UpsampleTerrainMeshResult, Without<Deleted>>,
) {
    if !tc.is_updated_in_this_frame {
        return;
    }

    let tile_layer = match tile_layers.iter().next() {
        Some((tile, _)) => tile,
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
                .is_some_and(|c| terrain_mesh_constructors.contains(c))
            || rendered_tile
                .terrain_mesh_upsampler
                .is_some_and(|c| terrain_mesh_upsamplers.contains(c));
        if !needs_update {
            continue;
        }

        let tile = qt.qt.get(rendered_tile.tile_handle).unwrap();
        let is_root = tile.is_root();
        let scale = if is_root { 0.98 } else { 1. };
        let render_order = if is_root { -1 } else { 0 };

        let ready_parent_tile = tc
            .rendered_tile_caches
            .get(&rendered_tile.tile_handle)
            .and_then(|t| t.ready_parent_tile_handle);

        if terrain_qt.qt.get(rendered_tile.tile_handle).is_none() {
            terrain_qt
                .qt
                .initialize_leaf((tile.coords.x, tile.coords.y, tile.coords.z), &|_coords| {
                    TerrainInformation::new()
                });
        }

        let extent = tile.extent;

        let should_render_terrain = terrain_layer.is_some();
        let should_compute_normal_from_vertex =
            terrain_layer.is_some_and(|t| t.should_compute_normal_from_vertex);

        let texture_fragment_entity_ids = &tile.texture_fragment_entity_ids;

        let tile_layers_len = tile_layers.iter().len();
        let mut shows = Vec::with_capacity(tile_layers_len);
        let mut opacities = Vec::with_capacity(tile_layers_len);
        let mut colors = Vec::with_capacity(tile_layers_len);
        for (i, (l, _)) in tile_layers.iter().sort::<&Order>().enumerate() {
            let should_show = texture_fragment_entity_ids
                .as_ref()
                .and_then(|ids| ids.get(i))
                .and_then(|tex| tex.and_then(|tex| texture_fragment.get(tex).ok()))
                .is_some_and(|(_, tex)| tex.is_succeeded());
            let a = l.appearance().unwrap();
            shows.push(should_show && a.show);
            opacities.push(a.opacity.clamp(0., 1.));
            colors.push(a.color);
        }

        let appearance = RasterTileInternalMaterial {
            shows,
            opacities,
            colors,
            texture_fragments: texture_fragment_entity_ids.clone(),
            // TODO: Replace with one resource
            should_compute_normal_from_vertex: Some(should_compute_normal_from_vertex),
            // TODO: Replace with one resource
            wireframe: tile_layer.appearance().unwrap().wireframe,
        };

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

        let should_upsample_terrain =
            tile.should_upsampling(
                terrain_layer.map_or(1, |t| t.appearance.as_ref().unwrap().max_zoom),
            ) && tile.is_upsamplable(&qt, &terrain_data_requester, &terrain_layer);

        if !should_render_terrain
            || (terrain_layer
                .is_some_and(|t| t.appearance.as_ref().unwrap().min_zoom >= tile.coords.z)
                || (!should_upsample_terrain && is_terrain_failed))
        {
            let triangles = tile_triangles_flat(
                WGS84_32,
                &extent,
                if is_root {
                    65
                } else {
                    // TODO: Replace with one resource
                    tile_layer.appearance().unwrap().segments
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
                TileMeshMarker {
                    handle: rendered_tile.tile_handle,
                    ready_parent_tile_handle: ready_parent_tile,
                },
                MeshBundle {
                    mesh: Mesh {
                        vertices: vhandle,
                        indices: ihandle,
                        uvs: uvshandle,
                        active: false,
                        render_order,
                        uv_transform: Default::default(),
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

        fn postupdate_tile(
            tile: &mut RasterTile,
            terrain_info: &mut TerrainInformation,
            max_height: FloatType,
            min_height: FloatType,
        ) {
            let terrain_data = tile
                .terrain_data
                .as_mut()
                .expect("This line is invoked only in the tile has terrain");
            terrain_data.set_current_max_height(max_height);
            terrain_data.set_current_min_height(min_height);
            tile.max_height = max_height;
            tile.aabb
                .update(tile.extent, min_height.min(0.), max_height);

            terrain_info.max_height = max_height;
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
                TileMeshMarker {
                    handle: rendered_tile.tile_handle,
                    ready_parent_tile_handle: ready_parent_tile,
                },
                MeshBundle {
                    mesh: Mesh {
                        vertices: vhandle,
                        indices: ihandle,
                        uvs: uvshandle,
                        active: false,
                        render_order,
                        uv_transform: Default::default(),
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
            let terrain_info = terrain_qt.qt.get_mut(rendered_tile.tile_handle).unwrap();
            postupdate_tile(tile, terrain_info, max_height, min_height);

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
            TileMeshMarker {
                handle: rendered_tile.tile_handle,
                ready_parent_tile_handle: ready_parent_tile,
            },
            MeshBundle {
                mesh: Mesh {
                    vertices: vhandle,
                    indices: ihandle,
                    uvs: uvshandle,
                    active: false,
                    render_order,
                    uv_transform: Default::default(),
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
        let terrain_info = terrain_qt.qt.get_mut(rendered_tile.tile_handle).unwrap();
        postupdate_tile(tile, terrain_info, max_height, min_height);
    }
}

pub fn update_layer(
    mut commands: Commands,
    updated: Query<(Entity, &UpdateRasterTileLayerMarker)>,
    mut layers: Query<&mut TilesLayer>,
) {
    for (e, u) in &updated {
        let layer_id = u.layer_id.clone();
        for mut layer in &mut layers {
            if layer.layer_id != layer_id {
                continue;
            }

            if let Some(a) = &mut layer.appearance {
                a.set(&u.appearance);
            }
        }
        commands.entity(e).despawn();
    }
}

pub fn delete_layer(
    mut commands: Commands,
    mut qt: ResMut<RasterTileQuadtree>,
    mut rendered_tiles: Query<&mut RenderedTile, With<Rendered>>,
    deleted: Query<(Entity, &DeleteRasterTileLayerMarker)>,
    layers: Query<(Entity, &TilesLayer, &Order)>,
) {
    if deleted.is_empty() {
        return;
    }

    for (e, u) in &deleted {
        let layer_id = u.0.clone();
        for (le, layer, _) in &layers {
            if layer.layer_id != layer_id {
                continue;
            }
            commands.entity(le).despawn();
            break;
        }
        commands.entity(e).despawn();
    }

    for rendered_tile in &mut rendered_tiles {
        let tile = qt.qt.get_mut(rendered_tile.tile_handle).unwrap();
        for (_, u) in &deleted {
            let layer_id = u.0.clone();
            let mut is_removed = false;
            for (i, (_, layer, _)) in layers.iter().sort::<&Order>().enumerate() {
                if layer.layer_id != layer_id {
                    continue;
                }

                if let Some(Some(e)) = tile
                    .texture_fragment_entity_ids
                    .as_mut()
                    .and_then(|ids| (ids.len() > i).then(|| ids.remove(i)))
                {
                    commands.entity(e).insert(Deleted);
                }
                is_removed = true;

                break;
            }

            if is_removed {
                break;
            }
        }
    }
}

#[allow(clippy::too_many_arguments, clippy::type_complexity)]
pub fn update_mesh_material(
    tc: ResMut<TileCacheManager>,
    qt: ResMut<RasterTileQuadtree>,
    rendered_tiles: Query<(&RenderedTile, &OrderByDistance), With<Rendered>>,
    mut texture_fragment: ParamSet<(TileTextureFragmentQuery, ChangedTileTextureFragmentQuery)>,
    mut tile_layers: ParamSet<(
        Query<(&TilesLayer, &Order)>,
        Query<&TilesLayer, Changed<TilesLayer>>,
        RemovedComponents<TilesLayer>,
    )>,
    mut appearances: Query<
        (
            &mut TileMeshMarker,
            &mut Mesh,
            &mut RasterTileInternalMaterial,
        ),
        Without<Deleted>,
    >,
) {
    let are_tile_layers_updated = !tile_layers.p1().is_empty();
    let are_tile_layers_removed = !tile_layers.p2().is_empty();
    let are_texture_fragments_updated = !texture_fragment.p1().is_empty();
    if !are_tile_layers_updated && !are_texture_fragments_updated && !are_tile_layers_removed {
        return;
    }

    let tile_layers = tile_layers.p0();
    let texture_fragment = texture_fragment.p0();

    for (rendered_tile, _) in rendered_tiles.iter().sort::<&OrderByDistance>() {
        let Some(tile) = qt.qt.get(rendered_tile.tile_handle) else {
            continue;
        };

        let Some(cached_rendered_tile) = tc.rendered_tile_caches.get(&rendered_tile.tile_handle)
        else {
            continue;
        };

        let texture_fragment_entity_ids = match &tile.texture_fragment_entity_ids {
            Some(texture_fragment_entity_ids) => texture_fragment_entity_ids,
            // Use a parent texture if this tile hasn't been prepared yet.
            None => &vec![],
        };

        let mut parent_z = None;
        let texture_fragment_entity_ids = if tile.is_texture_ready(&texture_fragment) {
            texture_fragment_entity_ids
        } else {
            // Use the parent tile if this tile doesn't have a tile.
            match cached_rendered_tile
                .ready_parent_tile_handle
                .and_then(|h| qt.qt.get(h))
                .and_then(|parent_tile| {
                    parent_tile
                        .texture_fragment_entity_ids
                        .as_ref()
                        .map(|v| (v, parent_tile.coords.z))
                }) {
                Some((v, parent_z_)) => {
                    parent_z = Some(parent_z_);
                    v
                }
                None => texture_fragment_entity_ids,
            }
        };

        let Some((tile_mesh_marker, _, appearance)) = cached_rendered_tile
            .mesh_entity
            .and_then(|e| appearances.get(e).ok())
        else {
            continue;
        };

        let mut needs_update = are_tile_layers_removed
            || 
            // If it has a different parent tile, it should be updated.
            tile_mesh_marker.ready_parent_tile_handle
                != cached_rendered_tile.ready_parent_tile_handle;

        let prev_texture_fragments = &appearance.texture_fragments;
        let prev_shows = &appearance.shows;
        let prev_colors = &appearance.colors;
        let prev_opacities = &appearance.opacities;

        let tile_layers_len = tile_layers.iter().len();
        let mut shows = Vec::with_capacity(tile_layers_len);
        let mut opacities = Vec::with_capacity(tile_layers_len);
        let mut colors = Vec::with_capacity(tile_layers_len);
        for (i, (l, _)) in tile_layers.iter().sort::<&Order>().enumerate() {
            // If this tile isn't ready, the remaining tiles aren't ready either.
            let should_show = texture_fragment_entity_ids
                .get(i)
                .and_then(|tex| tex.and_then(|tex| texture_fragment.get(tex).ok()))
                .is_some_and(|(_, tex)| tex.is_succeeded());

            let a = l.appearance().unwrap();
            let next_show = should_show && a.show;
            let next_opacity = a.opacity;
            let next_color = a.color;

            if prev_shows.get(i) != Some(&next_show)
                || prev_opacities.get(i) != Some(&next_opacity)
                || prev_colors.get(i) != Some(&next_color)
                || prev_texture_fragments.as_ref().and_then(|t| t.get(i))
                    != texture_fragment_entity_ids.get(i)
            {
                needs_update = true;
            }

            shows.push(next_show);
            opacities.push(a.opacity.clamp(0., 1.));
            colors.push(a.color);
        }

        if !needs_update {
            continue;
        }

        let Some((mut tile_mesh_marker, mut mesh, mut appearance)) = cached_rendered_tile
            .mesh_entity
            .and_then(|e| appearances.get_mut(e).ok())
        else {
            continue;
        };

        tile_mesh_marker.ready_parent_tile_handle = cached_rendered_tile.ready_parent_tile_handle;

        match parent_z {
            Some(parent_z) => {
                mesh.uv_transform = uv_transform(tile.coords, parent_z);
            }
            None => mesh.uv_transform = Default::default(),
        }

        appearance.texture_fragments = Some(texture_fragment_entity_ids.clone());

        appearance.shows = shows;
        appearance.opacities = opacities;
        appearance.colors = colors;
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

pub fn add_order_to_tiles_layer(
    mut commands: Commands,
    tiles_layers: Query<Entity, Added<TilesLayer>>,
    existing_orders: Query<&Order, With<TilesLayer>>,
) {
    // Find the maximum existing order value
    let max_order = existing_orders.iter().map(|o| o.0).max().unwrap_or(0);

    // Assign incremental order values to each new layer
    for (i, entity) in tiles_layers.iter().enumerate() {
        let order_value = max_order + i + 1;
        commands.entity(entity).insert(Order(order_value));
    }
}

pub fn clear_caches(
    mut commands: Commands,
    mut tc: ResMut<TileCacheManager>,
    mut qt: ResMut<RasterTileQuadtree>,
    mut terrain_qt: ResMut<TerrainInformationQuadtree>,
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

        terrain_qt.qt.remove(rendered_tile.tile_handle);
    }

    let mut removed_handles = vec![];
    for handle in tc.requested_tile_caches.iter() {
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
