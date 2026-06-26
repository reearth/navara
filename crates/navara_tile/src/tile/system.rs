use bevy_ecs::prelude::*;
use bevy_ecs::system::SystemParam;
use navara_buffer_store::BufferStore;
use navara_component::{Deleted, Order, OrderByDistance, Priority, Rendered};
use navara_core::{Aabb, TileXYZ, WGS84_64};
use navara_data_requester::{DataManager, DataRequester, DataRequesterStatus};
use navara_fog::Fog;
use navara_frame::FrameManager;
use navara_geometry::{
    TileUvTransform, add_skirt_separate, calculate_skirt_height, make_wgs84_down_dir_fn,
    tile_triangles_flat, uv_transform,
};
use navara_material::RasterTileInternalMaterial;
use navara_math::{FloatType, Transform};

use navara_mesh::{CachedMeshHandle, Mesh, MeshBundle, ObjectBundle};
use navara_occluder::ellipsoidal_occluder::EllipsoidalOccluder;

use navara_camera::{CameraFrustum, CameraMarker};
use navara_tile_component::{
    ChangedTileTerrainDataRequesterQuery, ChangedTileTextureFragmentQuery, TerrainInformation,
    TerrainInformationQuadtree, TerrainTile, TerrainTileQuadtree, Tile, TileMeshMarker,
    TileTerrainDataRequesterQuery, TileTextureFragmentMarker, TileTextureFragmentQuery,
};
use navara_window::Window;
use navara_worker::{
    WorkerTaskCompleted,
    construct_terrain_mesh::{
        ConstructTerrainMeshMarker, ConstructTerrainMeshParameters, ConstructTerrainMeshResult,
        ConstructTerrainMeshWorkerTaskBundle,
    },
    upsample_terrain_mesh::{
        UpsampleTerrainMeshMarker, UpsampleTerrainMeshParameters, UpsampleTerrainMeshResult,
        UpsampleTerrainMeshWorkerTaskBundle,
    },
};

use crate::texture_fragment::request_hillshade_data_requester;

use super::{
    event::MeshPreparedEvent,
    render::RenderedTile,
    tile_cache_manager::TileCacheManager,
    traverse::{TraversalResult, prepare_tile_resource, spawn_tile_entity, traverse_terrain},
};

use navara_layer::{
    DeleteRasterTileLayerMarker, TerrainLayer, TilesLayer, UpdateRasterTileLayerMarker,
};

/// System parameter that groups BufferStore and DataManager to reduce parameter count
#[derive(SystemParam)]
pub struct DataResources<'w> {
    pub buf: ResMut<'w, BufferStore>,
    pub data_manager: ResMut<'w, DataManager>,
}

/// Initializes the quadtree roots. Driven by a newly added TerrainLayer when
/// present (the layer's appearance dictates the tiling scheme); otherwise falls
/// back to the default `Globe.tiling_scheme` so a terrain-less map still has
/// roots to traverse.
pub fn init_globe_tiling(
    terrain_layer: Query<&navara_layer::TerrainLayer, Added<navara_layer::TerrainLayer>>,
    mut globe: ResMut<navara_globe::Globe>,
    mut qt: ResMut<TerrainTileQuadtree>,
    mut initialized: Local<bool>,
) {
    if let Some(layer) = terrain_layer.iter().next() {
        let Some(appearance) = &layer.appearance else {
            return;
        };
        globe.tiling_scheme = appearance.tiling_scheme();
    } else if *initialized {
        return;
    }

    for root in globe.tiling_scheme.root_tiles() {
        let coords = (root.x, root.y, root.z);
        if qt.qt.leaf(coords).is_none() {
            let scheme = globe.tiling_scheme.clone();
            qt.qt.initialize_leaf(coords, &|(x, y, z)| {
                TerrainTile::new_with_scheme(TileXYZ { x, y, z }, 0., 0., scheme.clone())
            });
        }
    }

    *initialized = true;
}

#[allow(clippy::too_many_arguments, clippy::type_complexity)]
pub fn update_terrain(
    mut commands: Commands,
    mut qt: ResMut<TerrainTileQuadtree>,
    mut tc: ResMut<TileCacheManager>,
    mut data_resources: DataResources,
    frame: Res<FrameManager>,
    window: Res<Window>,
    globe: Res<navara_globe::Globe>,
    mut tiles_set: ParamSet<(Query<(&TilesLayer, &Order)>, Query<(), Changed<TilesLayer>>)>,
    mut terrain_layer_set: ParamSet<(Query<&TerrainLayer>, Query<(), Added<TerrainLayer>>)>,
    mut camera_set: ParamSet<(
        Query<(Ref<Transform>, Ref<CameraFrustum>), With<CameraMarker>>,
        Query<&Fog>,
    )>,
    changed_texture_fragment: ChangedTileTextureFragmentQuery,
    mut data_requesters_set: ParamSet<(
        Query<&DataRequester>,
        Query<
            &DataRequester,
            (
                With<TileTextureFragmentMarker>,
                Or<(Added<DataRequester>, Changed<DataRequester>)>,
            ),
        >,
    )>,
    mut terrain_data_requester_set: ParamSet<(
        TileTerrainDataRequesterQuery,
        ChangedTileTerrainDataRequesterQuery,
    )>,
    occluder: Query<Ref<EllipsoidalOccluder>>,
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
    let is_data_requester_changed = !terrain_data_requester_set.p1().is_empty();
    let is_texture_data_requester_changed = !data_requesters_set.p1().is_empty();
    let is_mesh_changed = !meshes_set.p1().is_empty();
    let is_tile_layer_added = !tiles_set.p1().is_empty();
    let is_terrain_layer_added = !terrain_layer_set.p1().is_empty();

    let mut meshes = meshes_set.p0();
    let terrain_data_requester = terrain_data_requester_set.p0();
    let data_requesters = data_requesters_set.p0();

    // TODO: Think how to support multiple terrain layer.(Is it possible?)
    let terrain_layer = terrain_layer_set.p0();
    let terrain_layer = terrain_layer.iter().next();

    let occluder = occluder.iter().next().unwrap();

    let fog = camera_set.p1().single().unwrap().clone();
    let camera = camera_set.p0();
    let (camera, frustum) = camera.single().unwrap();

    // Since TilesLayer is added asynchronously, we need to check if it's changed at last frame by ourself.
    let tiles = &tiles_set.p0();
    let tiles_len = tiles.iter().len();
    let is_layers_len_changed = tiles_len != tc.prev_layers_len;

    let needs_update = is_texture_fragment_changed
        || is_data_requester_changed
        || is_texture_data_requester_changed
        || is_mesh_changed
        || tc.is_updated_in_this_frame
        || camera.is_added()
        || camera.is_changed()
        || frustum.is_changed()
        || occluder.is_changed()
        || is_tile_layer_added
        || is_terrain_layer_added
        || is_layers_len_changed;
    if !needs_update {
        return;
    }

    tc.is_updated_in_this_frame = true;
    tc.last_rendered_frame = frame.rendered_frame();
    tc.prev_layers_len = tiles_len;

    let root_coords: Vec<TileXYZ> = globe.tiling_scheme.root_tiles();

    let is_over_min_z = if !tiles.is_empty() {
        tiles.iter().any(|t| t.0.is_over_min_zoom(0))
    } else {
        true
    };

    for root in &root_coords {
        let coords = (root.x, root.y, root.z);
        let Some(root_handle) = qt.qt.leaf(coords).map(|n| n.handle()) else {
            continue;
        };

        let is_texture_ready = qt
            .qt
            .get_mut(root_handle)
            .unwrap()
            .is_hillshade_ready(&data_requesters, tiles);

        let traversal_result = traverse_terrain(
            &mut commands,
            tiles,
            &terrain_layer,
            root_handle,
            &mut tc,
            &mut qt,
            &mut data_resources.buf,
            &mut data_resources.data_manager,
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
            globe.max_sse as f64,
            false,
            false,
            is_texture_ready.then_some(root_handle),
            None,
        );

        // Skip rendering root tile if below minimum zoom, but allow traversal above.
        if !is_over_min_z {
            continue;
        }

        match traversal_result {
            TraversalResult::TileRendered => {
                spawn_tile_entity(
                    &mut commands,
                    &mut tc,
                    &frame,
                    qt.qt.get_mut(root_handle).unwrap(),
                    root_handle,
                    None,
                    None,
                );
                if tc.is_rendered_tile_prepared(&root_handle) {
                    tc.activate_rendered_tile(&root_handle, &mut meshes, true);
                }
            }
            TraversalResult::NotFound => {
                prepare_tile_resource(
                    &mut commands,
                    &mut qt,
                    &mut data_resources.buf,
                    &mut data_resources.data_manager,
                    &terrain_layer,
                    root_handle,
                    &mut tc,
                    tiles,
                    &data_requesters,
                    &terrain_data_requester,
                    Priority::Extreme,
                );
                let tile = qt.qt.get_mut(root_handle).unwrap();
                request_hillshade_data_requester(
                    &mut commands,
                    tile,
                    tiles,
                    root_handle,
                    &data_requesters,
                    Priority::High,
                    &mut data_resources.buf,
                    &mut data_resources.data_manager,
                );
            }
            TraversalResult::ChildrenMeshesPrepared => {
                tc.activate_rendered_tile(&root_handle, &mut meshes, false);
            }
            _ => {}
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
    mut qt: ResMut<TerrainTileQuadtree>,
    mut terrain_qt: ResMut<TerrainInformationQuadtree>,
    mut rendered_tiles: Query<
        (Entity, &mut RenderedTile, &OrderByDistance),
        Or<(Added<RenderedTile>, Without<Rendered>)>,
    >,
    data_requesters: Query<&DataRequester>,
    terrain_data_requester: TileTerrainDataRequesterQuery,
    tile_layers: Query<(&TilesLayer, &Order)>,
    terrain_layer: Query<&TerrainLayer>,
    terrain_mesh_constructors: Query<&ConstructTerrainMeshResult, Without<Deleted>>,
    terrain_mesh_upsamplers: Query<&UpsampleTerrainMeshResult, Without<Deleted>>,
    globe: Res<navara_globe::Globe>,
) {
    if !tc.is_updated_in_this_frame {
        return;
    }

    // TODO: Support mutiple terrain layers
    let terrain_layer = terrain_layer.iter().next();

    let tile_size = terrain_layer.map(|l| l.appearance.as_ref().unwrap().tile_size());

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
        let tile_aabb = tile.aabb().clone();
        let is_root = tile.is_root();
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
        let is_ellipsoid_terrain = terrain_layer
            .map(|l| matches!(l.terrain_type, navara_layer::TerrainDataType::Ellipsoid))
            .unwrap_or(false);
        let is_quantized_mesh = terrain_layer
            .map(|l| matches!(l.terrain_type, navara_layer::TerrainDataType::QuantizedMesh))
            .unwrap_or(false);
        let qm_geographic = terrain_layer
            .and_then(|l| l.appearance.as_ref())
            .is_some_and(|a| a.geographic());
        let qm_tms = terrain_layer
            .and_then(|l| l.appearance.as_ref())
            .is_some_and(|a| a.tms());

        let tile_layers_len = tile_layers.iter().len();
        let mut shows = Vec::with_capacity(tile_layers_len);
        let mut opacities = Vec::with_capacity(tile_layers_len);
        let mut colors = Vec::with_capacity(tile_layers_len);

        // Elevation Heatmap fields
        let mut is_elevation_heatmaps = Vec::with_capacity(tile_layers_len);
        let mut shared_heatmap_config = None;

        // Hillshade fields
        let mut is_hillshades = Vec::with_capacity(tile_layers_len);
        let mut layer_uv_transforms = Vec::with_capacity(tile_layers_len);
        let mut shared_hillshade_config = None;
        let mut tile_show_bounding_box = false;

        for (i, (l, _)) in tile_layers.iter().sort::<&Order>().enumerate() {
            // The initial material only reflects terrain-owned hillshade readiness;
            // regular raster textures are draped later in `update_mesh_material`.
            let mut should_show = false;
            if let Some(hill_entity) = tile
                .hillshade_entity_ids
                .as_ref()
                .and_then(|ids| ids.get(i))
                .and_then(|&e| e)
                && let Ok(dr) = data_requesters.get(hill_entity)
            {
                should_show = dr.is_succeeded();
            }

            let a = l.appearance().unwrap();
            shows.push(should_show && a.show);
            opacities.push(a.opacity.clamp(0., 1.));
            colors.push(a.color);
            tile_show_bounding_box = tile_show_bounding_box || a.show_bounding_box;

            // Mark whether this layer is an elevation heatmap
            if let Some(heatmap_config) = &l.elevation_heatmap_config {
                is_elevation_heatmaps.push(true);
                // Use the first heatmap config as shared configuration
                if shared_heatmap_config.is_none() {
                    shared_heatmap_config = Some(heatmap_config);
                }
            } else {
                is_elevation_heatmaps.push(false);
            }

            // Mark whether this layer is a hillshade
            if let Some(hillshade_config) = &l.hillshade_config {
                is_hillshades.push(true);
                // Use the first hillshade config as shared configuration
                if shared_hillshade_config.is_none() {
                    shared_hillshade_config = Some(hillshade_config);
                }
            } else {
                is_hillshades.push(false);
            }

            // Per-layer UV transform is finalized in `update_mesh_material` once each
            // layer's actual parent (LayerParent) is resolved.
            layer_uv_transforms.push(None);
        }

        // Extract shared elevation heatmap configuration (or use defaults)
        let (cast_shadow, receive_shadow, terrain_show_bounding_box) = terrain_layer
            .and_then(|l| l.appearance.as_ref())
            .map_or((false, false, false), |appearance| {
                (
                    appearance.cast_shadow(),
                    appearance.receive_shadow(),
                    appearance.show_bounding_box(),
                )
            });

        // The initial material carries only terrain-owned hillshade entities;
        // regular raster textures are pulled by extent in `update_mesh_material`.
        let merged_texture_fragments = tile.hillshade_entity_ids.clone();

        let appearance = RasterTileInternalMaterial {
            shows,
            opacities,
            colors,
            texture_fragments: merged_texture_fragments,
            cast_shadow: Some(cast_shadow),
            receive_shadow: Some(receive_shadow),
            show_bounding_box: Some(tile_show_bounding_box || terrain_show_bounding_box),

            // Elevation Heatmap fields
            is_elevation_heatmaps,
            elevation_heatmap_config: shared_heatmap_config.cloned(),

            // Hillshade fields
            is_hillshades,
            hillshade_config: shared_hillshade_config.cloned(),
            layer_uv_transforms,
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

        // Take the upsample branch either when we're in the configured upsample band
        // OR when our own DEM request failed but the parent terrain is ready.
        let should_upsample_terrain = terrain_layer.is_some()
            && tile.is_upsamplable(&qt, &terrain_data_requester, &terrain_layer)
            && (terrain_layer.is_some_and(|l| l.should_upsample(tile.coords.z))
                || is_terrain_failed);

        if !should_render_terrain
            || is_ellipsoid_terrain
            || (terrain_layer.is_some_and(|t| !t.is_over_min_zoom(tile.coords.z))
                || (!should_upsample_terrain && is_terrain_failed))
        {
            // TODO: Move these tile construction process to worker.
            let (mut triangles, rtc_translation) = tile_triangles_flat(
                WGS84_64,
                &extent,
                if is_root { 65 } else { globe.segments },
                0.,
            );

            // Render the skirt as well if the terrain layer is also used.
            let (skirt, skirt_exaggeration) = terrain_layer
                .and_then(|l| l.appearance.as_ref())
                .map_or((true, 1.0), |appearance| {
                    (appearance.skirt(), appearance.skirt_exaggeration())
                });
            if should_render_terrain && skirt {
                // Use terrain tile_size if available, otherwise default to 256
                let skirt_height =
                    calculate_skirt_height(&WGS84_64, tile.coords.z, skirt_exaggeration);
                let down_dir_fn = make_wgs84_down_dir_fn(WGS84_64, Some(rtc_translation));
                add_skirt_separate(&mut triangles, skirt_height, &down_dir_fn);
            }
            let v_skirt_handle = triangles.skirt_vertices.map(|b| buf.new_f32(b));
            let i_skirt_handle = triangles.skirt_indices.map(|b| buf.new_u32(b));
            let u_skirt_handle = triangles.skirt_uvs.map(|b| buf.new_f32(b));
            let e_skirt_handle = triangles.skirt_indices_to_edge.map(|b| buf.new_u32(b));

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
                        normals: None,
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
                        aabb: Aabb {
                            center: Transform::from_translation(-rtc_translation)
                                .transform_point(tile_aabb.center),
                            extents: tile_aabb.extents,
                        },
                        // Flat tiles don't carry quantized-mesh normals or watermask.
                        normals: None,
                        skirt_vertices: v_skirt_handle,
                        skirt_uvs: u_skirt_handle,
                        skirt_indices: i_skirt_handle,
                        skirt_indices_to_edge: e_skirt_handle,
                        skirt_normals: None,
                        watermask: None,
                    },
                    material: appearance,
                    object: ObjectBundle {
                        transform: Transform::from_translation(rtc_translation),
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

        fn postupdate_tile(
            tile: &mut TerrainTile,
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
            tile.update_heights(max_height, min_height);

            terrain_info.max_height = max_height;
            terrain_info.min_height = min_height;
        }

        // Get skirt settings from terrain layer
        let (skirt, skirt_exaggeration) = terrain_layer
            .and_then(|l| l.appearance.as_ref())
            .map_or((true, 1.0), |appearance| {
                (appearance.skirt(), appearance.skirt_exaggeration())
            });

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
                                    skirt,
                                    skirt_exaggeration,
                                    is_quantized_mesh,
                                    geographic: qm_geographic,
                                    tms: qm_tms,
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
            let rtc_translation = terrain_mesh_upsampler.rtc_translation.unwrap_or_default();

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
                        normals: terrain_mesh_upsampler.geometry.normals,
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
                        aabb: Aabb {
                            center: Transform::from_translation(-rtc_translation)
                                .transform_point(tile_aabb.center),
                            extents: tile_aabb.extents,
                        },
                        normals: terrain_mesh_upsampler.geometry.normals,
                        skirt_vertices: terrain_mesh_upsampler.geometry.skirt_vertices,
                        skirt_uvs: terrain_mesh_upsampler.geometry.skirt_uvs,
                        skirt_indices: terrain_mesh_upsampler.geometry.skirt_indices,
                        skirt_indices_to_edge: terrain_mesh_upsampler
                            .geometry
                            .skirt_indices_to_edge,
                        skirt_normals: terrain_mesh_upsampler.geometry.skirt_normals,
                        watermask: None,
                    },
                    material: appearance,
                    object: ObjectBundle {
                        transform: Transform::from_translation(rtc_translation),
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

        let terrain_mesh_constructor_id = match rendered_tile.terrain_mesh_constructor {
            Some(e) => e,
            None => {
                let terrain_mesh_constructor = commands
                    .spawn((
                        ConstructTerrainMeshWorkerTaskBundle::new(
                            ConstructTerrainMeshMarker,
                            ConstructTerrainMeshParameters {
                                tile_size: tile_size.unwrap(),
                                bytes_handle: terrain_req.handle,
                                tile_handle: rendered_tile.tile_handle,
                                skirt,
                                skirt_exaggeration,
                                is_quantized_mesh,
                                geographic: qm_geographic,
                                tms: qm_tms,
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
        let rtc_translation = terrain_mesh_constructor.rtc_translation.unwrap_or_default();

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
                    normals: terrain_mesh_constructor.geometry.normals,
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
                    aabb: Aabb {
                        center: Transform::from_translation(-rtc_translation)
                            .transform_point(tile_aabb.center),
                        extents: tile_aabb.extents,
                    },
                    normals: terrain_mesh_constructor.geometry.normals,
                    skirt_vertices: terrain_mesh_constructor.geometry.skirt_vertices,
                    skirt_uvs: terrain_mesh_constructor.geometry.skirt_uvs,
                    skirt_indices: terrain_mesh_constructor.geometry.skirt_indices,
                    skirt_indices_to_edge: terrain_mesh_constructor.geometry.skirt_indices_to_edge,
                    skirt_normals: terrain_mesh_constructor.geometry.skirt_normals,
                    watermask: terrain_mesh_constructor.watermask,
                },
                material: appearance,
                object: ObjectBundle {
                    transform: Transform::from_translation(rtc_translation),
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

            // Update elevation_heatmap_config if provided
            if u.elevation_heatmap_config.is_some() {
                layer.elevation_heatmap_config = u.elevation_heatmap_config.clone();
            }

            // Update hillshade_config if provided
            if u.hillshade_config.is_some() {
                layer.hillshade_config = u.hillshade_config.clone();
            }
        }
        commands.entity(e).despawn();
    }
}

pub fn delete_layer(
    mut commands: Commands,
    mut qt: ResMut<TerrainTileQuadtree>,
    mut raster_qt: ResMut<navara_tile_component::RasterTileQuadtree>,
    raster_tc: Res<crate::raster::RasterTileCacheManager>,
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

    // The compaction below relies on `idx - removed_idx` to translate an
    // original sorted-layer index into its current (already-shifted) position.
    // That arithmetic is only correct when the indices are strictly increasing:
    // duplicates (e.g. two delete markers spawned for the same layer in one
    // frame) would either over-remove slots or underflow `usize`.
    //
    // Collecting the marker ids into a set and filtering the sorted layers in a
    // single pass yields strictly increasing, duplicate-free indices by
    // construction, so no later sort/dedup is needed (and it avoids the
    // per-layer linear scan over every marker).
    let deleted_ids: std::collections::HashSet<&String> =
        deleted.iter().map(|(_, u)| &u.0).collect();
    let deleted_layers: Vec<usize> = layers
        .iter()
        .sort::<&Order>()
        .enumerate()
        .filter_map(|(i, (_, layer, _))| deleted_ids.contains(&layer.layer_id).then_some(i))
        .collect();

    // Per-layer arrays are indexed by the sorted-layer position, so a deleted
    // layer's slot must be removed (shifting the rest down) from BOTH the
    // terrain-side hillshade array AND the raster-side texture array, or the two
    // sides fall out of alignment and `resolve_raster_texture` reads the wrong
    // layer — breaking layer (z) order.
    for rendered_tile in &mut rendered_tiles {
        let tile = qt.qt.get_mut(rendered_tile.tile_handle).unwrap();
        for (removed_idx, idx) in deleted_layers.iter().enumerate() {
            let target_idx = idx - removed_idx;

            if let Some(hill) = tile.hillshade_entity_ids.as_mut()
                && target_idx < hill.len()
                && let Some(e) = hill.remove(target_idx)
            {
                commands.entity(e).insert(Deleted);
            }
        }
    }

    // Compact the same slot out of every live raster tile's texture array.
    // `active_handles` covers the visited tiles (including the ancestors that
    // `resolve_raster_texture` can fall back to).
    for handle in raster_tc.active_handles.iter() {
        let Some(raster_tile) = raster_qt.qt.get_mut(*handle) else {
            continue;
        };
        for (removed_idx, idx) in deleted_layers.iter().enumerate() {
            let target_idx = idx - removed_idx;

            if let Some(tex) = raster_tile.texture_fragment_entity_ids.as_mut()
                && target_idx < tex.len()
                && let Some(e) = tex.remove(target_idx)
            {
                commands.entity(e).insert(Deleted);
            }
        }
    }
}

#[allow(clippy::too_many_arguments, clippy::type_complexity)]
pub fn update_mesh_material(
    mut tc: ResMut<TileCacheManager>,
    qt: ResMut<TerrainTileQuadtree>,
    raster_qt: Res<navara_tile_component::RasterTileQuadtree>,
    rendered_tiles: Query<(&RenderedTile, &OrderByDistance), With<Rendered>>,
    mut texture_fragment: ParamSet<(TileTextureFragmentQuery, ChangedTileTextureFragmentQuery)>,
    mut data_requesters: ParamSet<(
        Query<&DataRequester>,
        Query<
            &DataRequester,
            (
                With<TileTextureFragmentMarker>,
                Or<(Added<DataRequester>, Changed<DataRequester>)>,
            ),
        >,
    )>,
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
    let are_data_requesters_updated = !data_requesters.p1().is_empty();
    let has_tiles_needing_material_update = tc
        .rendered_tile_caches
        .values()
        .any(|cache| cache.needs_material_update);

    if !are_tile_layers_updated
        && !are_texture_fragments_updated
        && !are_tile_layers_removed
        && !are_data_requesters_updated
        && !has_tiles_needing_material_update
    {
        return;
    }

    let tile_layers = tile_layers.p0();
    let texture_fragment = texture_fragment.p0();
    let data_requesters = data_requesters.p0();

    for (rendered_tile, _) in rendered_tiles.iter().sort::<&OrderByDistance>() {
        let Some(tile) = qt.qt.get(rendered_tile.tile_handle) else {
            continue;
        };

        let Some(cached_rendered_tile) = tc.rendered_tile_caches.get(&rendered_tile.tile_handle)
        else {
            continue;
        };

        let tile_layers_len = tile_layers.iter().len();

        let Some((tile_mesh_marker, _, appearance)) = cached_rendered_tile
            .mesh_entity
            .and_then(|e| appearances.get(e).ok())
        else {
            continue;
        };

        let mut needs_update = are_tile_layers_removed
            // If it has a different parent tile, it should be updated.
            || tile_mesh_marker.ready_parent_tile_handle
                != cached_rendered_tile.ready_parent_tile_handle;

        let prev_texture_fragments = &appearance.texture_fragments;
        let prev_shows = &appearance.shows;
        let prev_colors = &appearance.colors;
        let prev_opacities = &appearance.opacities;
        let prev_is_elevation_heatmaps = &appearance.is_elevation_heatmaps;
        let prev_is_hillshades = &appearance.is_hillshades;
        let prev_layer_uv_transforms = &appearance.layer_uv_transforms;

        let mut shows = Vec::with_capacity(tile_layers_len);
        let mut opacities = Vec::with_capacity(tile_layers_len);
        let mut colors = Vec::with_capacity(tile_layers_len);
        let mut is_elevation_heatmaps = Vec::with_capacity(tile_layers_len);
        let mut elevation_heatmap_config = None;

        // Hillshade fields
        let mut is_hillshades = Vec::with_capacity(tile_layers_len);
        let mut hillshade_config = None;

        // Per-layer fragment resolution: for each layer, use own entity if ready,
        // otherwise fall back to that layer's nearest ready ancestor recorded in
        // `cached_rendered_tile.layer_parents`. UV transform is per-layer too.
        let mut layer_fragments: Vec<Option<Entity>> = Vec::with_capacity(tile_layers_len);
        let mut layer_uv_transforms: Vec<Option<TileUvTransform>> =
            Vec::with_capacity(tile_layers_len);

        for (i, (l, _)) in tile_layers.iter().sort::<&Order>().enumerate() {
            // Hillshade layers stay terrain-side (DataRequester-backed); regular
            // raster layers are pulled from the WebMercator raster quadtree by
            // extent (Phase 1: identity coordinates, with ancestor fallback). Each
            // branch reports its own readiness so `should_show` needs no re-check.
            let (resolved_entity, resolved_uv, should_show) = if l.hillshade_config.is_some() {
                let own_entity = tile
                    .hillshade_entity_ids
                    .as_ref()
                    .and_then(|ids| ids.get(i).copied().flatten());
                let own_ready = own_entity
                    .is_some_and(|e| TerrainTile::is_hillshade_entity_ready(e, &data_requesters));
                if own_ready {
                    (own_entity, None, true)
                } else if let Some(parent) = cached_rendered_tile
                    .layer_parents
                    .as_ref()
                    .and_then(|v| v.get(i).copied().flatten())
                {
                    // Cached ancestor fallback: re-check readiness since the
                    // parent's hillshade may have been pruned across frames.
                    let ready =
                        TerrainTile::is_hillshade_entity_ready(parent.entity, &data_requesters);
                    (
                        Some(parent.entity),
                        Some(uv_transform(tile.coords, parent.zoom)),
                        ready,
                    )
                } else {
                    (None, None, false)
                }
            } else {
                // The raster pull only returns a fragment once it has loaded.
                match crate::raster::resolve_raster_texture(
                    &raster_qt,
                    tile.coords,
                    i,
                    &texture_fragment,
                ) {
                    Some(r) => (Some(r.entity), r.uv_transform, true),
                    None => (None, None, false),
                }
            };

            let a = l.appearance().unwrap();
            let next_show = should_show && a.show;
            let next_opacity = a.opacity;
            let next_color = a.color;

            // Check if this layer is an elevation heatmap
            let is_heatmap = l.elevation_heatmap_config.is_some();
            let is_hillshade_layer_check = l.hillshade_config.is_some();

            // Check if entity changed and new entity is ready
            let entity_changed =
                prev_texture_fragments.as_ref().and_then(|t| t.get(i)) != Some(&resolved_entity);

            // Only trigger update for entity changes when new entity is ready
            // This prevents flickering when entity is replaced with a pending one
            let should_update_for_entity_change = entity_changed && should_show;

            let uv_changed = prev_layer_uv_transforms.get(i) != Some(&resolved_uv);

            if prev_shows.get(i) != Some(&next_show)
                || prev_opacities.get(i) != Some(&next_opacity)
                || prev_colors.get(i) != Some(&next_color)
                || should_update_for_entity_change
                || prev_is_elevation_heatmaps.get(i) != Some(&is_heatmap)
                || prev_is_hillshades.get(i) != Some(&is_hillshade_layer_check)
                || uv_changed
            {
                needs_update = true;
            }

            shows.push(next_show);
            opacities.push(a.opacity.clamp(0., 1.));
            colors.push(a.color);
            is_elevation_heatmaps.push(is_heatmap);

            // Use the first elevation_heatmap_config we find (they should all be the same)
            if is_heatmap && elevation_heatmap_config.is_none() {
                elevation_heatmap_config = l.elevation_heatmap_config.clone();
            }

            is_hillshades.push(is_hillshade_layer_check);

            // Use the first hillshade_config we find (they should all be the same)
            if is_hillshade_layer_check && hillshade_config.is_none() {
                hillshade_config = l.hillshade_config.clone();
            }

            layer_fragments.push(resolved_entity);
            layer_uv_transforms.push(resolved_uv);
        }

        // Check if elevation_heatmap_config changed
        if appearance.elevation_heatmap_config != elevation_heatmap_config {
            needs_update = true;
        }

        // Check if hillshade_config changed
        if appearance.hillshade_config != hillshade_config {
            needs_update = true;
        }

        // Force update if tile cache has needs_material_update flag set
        if !needs_update && cached_rendered_tile.needs_material_update {
            needs_update = true;
        }

        if !needs_update {
            continue;
        }

        let Some((mut tile_mesh_marker, _mesh, mut appearance)) = cached_rendered_tile
            .mesh_entity
            .and_then(|e| appearances.get_mut(e).ok())
        else {
            continue;
        };

        tile_mesh_marker.ready_parent_tile_handle = cached_rendered_tile.ready_parent_tile_handle;

        appearance.texture_fragments = Some(layer_fragments);

        appearance.shows = shows;
        appearance.opacities = opacities;
        appearance.colors = colors;
        appearance.is_elevation_heatmaps = is_elevation_heatmaps;
        appearance.elevation_heatmap_config = elevation_heatmap_config;
        appearance.is_hillshades = is_hillshades;
        appearance.hillshade_config = hillshade_config;
        appearance.layer_uv_transforms = layer_uv_transforms;

        // Clear needs_material_update flag now that material has been updated
        if let Some(cache) = tc.rendered_tile_caches.get_mut(&rendered_tile.tile_handle) {
            cache.needs_material_update = false;
        }
    }
}

pub fn handle_prepared_mesh_event(
    mut events: MessageReader<MeshPreparedEvent>,
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
    mut qt: ResMut<TerrainTileQuadtree>,
    mut terrain_qt: ResMut<TerrainInformationQuadtree>,
    mut buf: ResMut<BufferStore>,
    mut rendered_tiles: Query<(Entity, &mut RenderedTile, &OrderByDistance)>,
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
        qt.qt
            .remove(rendered_tile.tile_handle)
            .unwrap()
            .destroy(&mut commands, &mut buf);

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

        qt.qt
            .remove(tile_handle)
            .unwrap()
            .destroy(&mut commands, &mut buf);

        removed_handles.push(tile_handle);
    }

    for removed in removed_handles {
        tc.requested_tile_caches.remove(&removed);
    }
}

#[cfg(test)]
mod delete_layer_tests {
    use super::*;
    use bevy_app::{App, Update};
    use navara_layer::LayerData;
    use navara_material::{Appearance, RasterTileMaterial};
    use navara_tile_component::{RasterTile, RasterTileQuadtree};

    use crate::raster::RasterTileCacheManager;

    fn raster_layer(layer_id: &str) -> TilesLayer {
        TilesLayer {
            layer_id: layer_id.to_string(),
            data: Some(LayerData {
                url: "https://example.com/{z}/{x}/{y}.png".to_string(),
            }),
            appearance: Some(Appearance::TerrainTile(RasterTileMaterial::default())),
            elevation_heatmap_config: None,
            hillshade_config: None,
        }
    }

    /// Deleting a middle raster layer must compact that slot out of the raster
    /// tile's `texture_fragment_entity_ids`, keeping the remaining layers aligned
    /// with the new sorted-layer order (the layer-ordering regression this guards).
    #[test]
    fn delete_layer_compacts_raster_texture_slots() {
        let mut app = App::new();
        app.insert_resource(TerrainTileQuadtree::new_with_linear_qt());

        // A raster tile carrying one texture entity per layer [A, B, C].
        let ea = app.world_mut().spawn_empty().id();
        let eb = app.world_mut().spawn_empty().id();
        let ec = app.world_mut().spawn_empty().id();

        let mut raster_qt = RasterTileQuadtree::new_with_linear_qt();
        raster_qt
            .qt
            .initialize_zero(&|(x, y, z)| RasterTile::new(TileXYZ { x, y, z }, 0., 0.));
        let handle = raster_qt.qt.zero().unwrap().handle();
        raster_qt
            .qt
            .get_mut(handle)
            .unwrap()
            .texture_fragment_entity_ids = Some(vec![Some(ea), Some(eb), Some(ec)]);
        app.insert_resource(raster_qt);

        let mut raster_tc = RasterTileCacheManager::default();
        raster_tc.active_handles.insert(handle);
        app.insert_resource(raster_tc);

        // Layers A(0), B(1), C(2); delete the middle one (B).
        app.world_mut().spawn((raster_layer("A"), Order(0)));
        app.world_mut().spawn((raster_layer("B"), Order(1)));
        app.world_mut().spawn((raster_layer("C"), Order(2)));
        app.world_mut()
            .spawn(DeleteRasterTileLayerMarker("B".to_string()));

        app.add_systems(Update, delete_layer);
        app.update();

        let raster_qt = app.world().resource::<RasterTileQuadtree>();
        let tex = raster_qt
            .qt
            .get(handle)
            .unwrap()
            .texture_fragment_entity_ids
            .as_ref()
            .unwrap();

        // B's slot is gone; A and C keep their relative order, now at indices 0,1.
        assert_eq!(tex, &vec![Some(ea), Some(ec)]);
    }

    /// Two delete markers for the *same* layer in one frame must compact exactly
    /// one slot. Without sort+dedup of the index list, the duplicate index makes
    /// `idx - removed_idx` over-remove a slot (and underflow `usize` when the
    /// duplicated layer sits at index 0).
    #[test]
    fn delete_layer_handles_duplicate_markers_for_same_layer() {
        let mut app = App::new();
        app.insert_resource(TerrainTileQuadtree::new_with_linear_qt());

        let ea = app.world_mut().spawn_empty().id();
        let eb = app.world_mut().spawn_empty().id();
        let ec = app.world_mut().spawn_empty().id();

        let mut raster_qt = RasterTileQuadtree::new_with_linear_qt();
        raster_qt
            .qt
            .initialize_zero(&|(x, y, z)| RasterTile::new(TileXYZ { x, y, z }, 0., 0.));
        let handle = raster_qt.qt.zero().unwrap().handle();
        raster_qt
            .qt
            .get_mut(handle)
            .unwrap()
            .texture_fragment_entity_ids = Some(vec![Some(ea), Some(eb), Some(ec)]);
        app.insert_resource(raster_qt);

        let mut raster_tc = RasterTileCacheManager::default();
        raster_tc.active_handles.insert(handle);
        app.insert_resource(raster_tc);

        // Delete the *first* layer (A, index 0) so a mishandled duplicate would
        // underflow `usize` on the second pass (0 - 1).
        app.world_mut().spawn((raster_layer("A"), Order(0)));
        app.world_mut().spawn((raster_layer("B"), Order(1)));
        app.world_mut().spawn((raster_layer("C"), Order(2)));
        app.world_mut()
            .spawn(DeleteRasterTileLayerMarker("A".to_string()));
        app.world_mut()
            .spawn(DeleteRasterTileLayerMarker("A".to_string()));

        app.add_systems(Update, delete_layer);
        app.update();

        let raster_qt = app.world().resource::<RasterTileQuadtree>();
        let tex = raster_qt
            .qt
            .get(handle)
            .unwrap()
            .texture_fragment_entity_ids
            .as_ref()
            .unwrap();

        // Exactly one slot (A) removed; B and C remain intact and in order.
        assert_eq!(tex, &vec![Some(eb), Some(ec)]);
    }
}
