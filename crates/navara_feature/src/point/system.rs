use bevy_ecs::{
    entity::Entity,
    query::{Added, With, Without},
    system::{Commands, Query, ResMut},
};
use navara_buffer_store::BufferStore;
use navara_component::Deleted;
use navara_core::{Aabb, WGS84_64};
use navara_feature_component::{
    batch::{
        BatchId, BatchIndex, BatchTable, BatchedFeature, FeatureBatchId, FeatureBatchIdMap,
        GlobalBatchIds,
    },
    id::FeatureId,
    render::{RenderInformation, RenderableFeature, TransferablePointGeometry},
    BatchedFeatureMarker, LODFeatureMarker,
};
use navara_layer::{LayerId, LayerStore};
use navara_material::PointMaterial;
use navara_math::{Transform, Vec3};
use navara_mvt::MVTFeatureMarker;
use navara_tile_component::{
    compute_terrain_height_at_point, RasterTileQuadtree, TileExtent, TileMeshMarker,
    TileTerrainDataRequesterQuery,
};

use navara_feature_component::point::{PointGeometry, PointMarker};

#[allow(clippy::type_complexity)]
pub fn transfer_batched_mesh(
    mut commands: Commands,
    mut feature_batch_id_map: ResMut<FeatureBatchIdMap>,
    mut batched_features: Query<
        (
            Entity,
            &LayerId,
            &PointMaterial,
            &BatchedFeature,
            &FeatureBatchId,
            &GlobalBatchIds,
            &mut FeatureId,
            Option<&TileExtent>,
            Option<&MVTFeatureMarker>,
        ),
        (With<PointMarker>, Without<Deleted>),
    >,
    points: Query<(&PointGeometry, &BatchIndex)>,
    mut layer_store: ResMut<LayerStore>,
    mut buf: ResMut<BufferStore>,
) {
    for (
        batched_feature_entity,
        layer_id,
        material,
        batched_feature,
        feature_batch_id,
        global_batch_ids,
        mut feature_id,
        tile_extent_component,
        mvt_marker,
    ) in &mut batched_features
    {
        // Skip if already processed
        if feature_id.0.is_some() {
            continue;
        }

        if mvt_marker.is_some() && tile_extent_component.is_none() {
            // MVT tile but TileExtent not yet applied, wait for next frame
            continue;
        }

        // Extract all point geometries and create batch indices and IDs in a single loop
        let feature_len = batched_feature.features.len();
        let mut all_coords = Vec::with_capacity(feature_len * 3);
        let mut batch_indices = Vec::with_capacity(feature_len);
        let mut batch_ids = Vec::with_capacity(feature_len);
        let mut crs = None;

        // Get the global batch IDs from the buffer store
        let Some(global_ids) = buf.get_u32(&global_batch_ids.handle) else {
            continue;
        };

        let rtc_center = tile_extent_component.map(|extent_component| {
            let aabb = Aabb::from_extent_f64(extent_component.extent, 0., 1.);
            aabb.center
        });

        // TODO: Remove this iteration
        for feature_entity in &batched_feature.features {
            let (point_geometry, batch_index) = points.get(*feature_entity).unwrap();

            // Store the CRS from the first point
            if crs.is_none() {
                crs = Some(point_geometry.crs.clone());
            }

            // Transform the coordinates and add to our batch
            let transformed_pos =
                point_geometry
                    .crs
                    .to_vec3(WGS84_64, point_geometry.coords, material.height);

            let local_pos = if let Some(center) = rtc_center {
                Vec3::new(
                    transformed_pos.x - center.x,
                    transformed_pos.y - center.y,
                    transformed_pos.z - center.z,
                )
            } else {
                transformed_pos
            };

            all_coords.push(local_pos.x as f32);
            all_coords.push(local_pos.y as f32);
            all_coords.push(local_pos.z as f32);

            // Add batch index
            batch_indices.push(batch_index.0);

            let global_index = (batch_index.0) as usize;
            batch_ids.push(global_ids[global_index] as f32);
        }

        let crs = crs.unwrap();

        let transform = if let Some(center) = rtc_center {
            Transform::from_translation(center).with_scale(Vec3::new(
                material.size as f64,
                material.size as f64,
                material.size as f64,
            ))
        } else {
            Transform::from_scale(Vec3::new(
                material.size as f64,
                material.size as f64,
                material.size as f64,
            ))
        };

        // Create the renderable feature entity
        let entity = commands
            .spawn((
                PointMarker,
                BatchedFeatureMarker,
                layer_id.clone(),
                RenderableFeature::Point {
                    coordinates: Vec3::ZERO, // Not used for batched features
                    crs,
                    material: material.clone(),
                    transform,
                    feature_id: batched_feature_entity,
                    render_info: RenderInformation {
                        current_terrain_height: 0.,
                        is_rendered: false,
                        should_recalculate_height: true,
                    },
                    geometry: TransferablePointGeometry::with_buf_rtc(
                        &mut buf,
                        all_coords,
                        batch_indices,
                        batch_ids,
                    ),
                    active: false,
                    feature_batch_id: feature_batch_id.0,
                    batch_length: batched_feature.features.len() as u32,
                },
            ))
            .id();

        feature_id.0 = Some(entity);

        layer_store.add(layer_id.0.clone(), entity);

        feature_batch_id_map.add(entity, global_batch_ids.clone());
    }
}

#[allow(clippy::type_complexity)]
pub fn transfer_mesh(
    mut commands: Commands,
    mut buf: ResMut<BufferStore>,
    mut points: Query<
        (
            Entity,
            &LayerId,
            &BatchId,
            Option<&mut FeatureId>,
            &PointGeometry,
            &PointMaterial,
            Option<&LODFeatureMarker>,
        ),
        (Added<PointGeometry>, Without<BatchedFeatureMarker>),
    >,
    mut layer_store: ResMut<LayerStore>,
) {
    for (entity, layer_id, batch_id, feature_id, geometry, material, lod_marker) in &mut points {
        let position = geometry
            .crs
            .to_vec3(WGS84_64, geometry.coords, material.height);

        // Use RTC for all points: transform contains absolute world position,
        // geometry contains relative coordinates (0, 0, 0 for single points)
        let entity = commands
            .spawn((
                PointMarker,
                layer_id.clone(),
                RenderableFeature::Point {
                    coordinates: geometry.coords,
                    crs: geometry.crs.clone(),
                    material: material.clone(),
                    transform: Transform::from_scale(Vec3::new(
                        material.size as f64,
                        material.size as f64,
                        material.size as f64,
                    )),
                    feature_id: entity,
                    render_info: RenderInformation {
                        current_terrain_height: 0.,
                        is_rendered: false,
                        should_recalculate_height: material.clamp_to_ground,
                    },
                    geometry: TransferablePointGeometry::with_buf_rte(
                        &mut buf,
                        vec![position.x, position.y, position.z],
                        vec![0],
                        vec![batch_id.0],
                    ),
                    active: lod_marker.is_none(),
                    feature_batch_id: batch_id.0 as u32,
                    batch_length: 1,
                },
            ))
            .id();

        if let Some(mut feature_id) = feature_id {
            feature_id.0 = Some(entity);
        }

        layer_store.add(layer_id.0.clone(), entity);
    }
}

// TODO: This system is executed whenever a tile is added.
//       This isn't efficient, so we need to update this system
//       to execute only when the layer's bounding box is within the camera frustum.
#[allow(clippy::too_many_arguments, clippy::type_complexity)]
pub fn update_height_by_terrain_for_batched(
    mut qt: ResMut<RasterTileQuadtree>,
    mut buf: ResMut<BufferStore>,
    mut renderable_features: Query<
        (&PointMarker, &mut RenderableFeature),
        With<BatchedFeatureMarker>,
    >,
    batched_features: Query<&BatchedFeature, (With<PointMarker>, Without<Deleted>)>,
    geometries: Query<&PointGeometry>,
    tile_meshes: Query<&TileMeshMarker, Added<TileMeshMarker>>,
    terrain_data_requester: TileTerrainDataRequesterQuery,
) {
    let is_tile_meshes_empty = tile_meshes.is_empty();

    for (_, mut feature) in &mut renderable_features {
        match feature.as_ref() {
            RenderableFeature::Point {
                render_info,
                material,
                active,
                ..
            } => {
                if (is_tile_meshes_empty || !material.clamp_to_ground)
                    && !render_info.should_recalculate_height
                {
                    continue;
                }
                if !material.show || !active {
                    continue;
                }
            }
            _ => continue,
        };

        match feature.as_mut() {
            RenderableFeature::Point {
                coordinates: _,
                crs: _,
                material,
                feature_id,
                render_info,
                geometry,
                transform,
                ..
            } => {
                render_info.should_recalculate_height = false;
                let Ok(batched_feature) = batched_features.get(*feature_id) else {
                    continue;
                };

                let feature_len = batched_feature.features.len();
                let mut all_coords = Vec::with_capacity(feature_len * 3);

                // Get RTC center from transform translation
                let rtc_center = transform.translation;

                for feature_id in &batched_feature.features {
                    let geometry = geometries.get(*feature_id).unwrap();
                    if material.clamp_to_ground {
                        let terrain_height = compute_terrain_height_at_point(
                            &mut qt,
                            &mut buf,
                            &terrain_data_requester,
                            &geometry.crs.to_lng_lat(WGS84_64, geometry.coords),
                        )
                        .unwrap_or(0.);
                        render_info.current_terrain_height =
                            render_info.current_terrain_height.max(terrain_height);
                    } else {
                        render_info.current_terrain_height = 0.;
                    }
                    let position = geometry.crs.to_vec3(
                        WGS84_64,
                        geometry.coords,
                        material.height + render_info.current_terrain_height as f32,
                    );

                    // Convert to RTC coordinates (relative to tile center)
                    let local_pos = Vec3::new(
                        position.x - rtc_center.x,
                        position.y - rtc_center.y,
                        position.z - rtc_center.z,
                    );

                    all_coords.push(local_pos.x as f32);
                    all_coords.push(local_pos.y as f32);
                    all_coords.push(local_pos.z as f32);
                }

                if let Some(position) = &mut geometry.position {
                    buf.remove(&position.data);
                    position.data = buf.new_f32(all_coords);
                }
            }
            _ => unreachable!(),
        };
    }
}

// TODO: This system is executed whenever a tile is added.
//       This isn't efficient, so we need to update this system
//       to execute only when the layer's bounding box is within the camera frustum.
#[allow(clippy::too_many_arguments, clippy::type_complexity)]
pub fn update_height_by_terrain(
    mut qt: ResMut<RasterTileQuadtree>,
    mut buf: ResMut<BufferStore>,
    mut renderable_features: Query<
        (&PointMarker, &mut RenderableFeature),
        Without<BatchedFeatureMarker>,
    >,
    geometries: Query<&PointGeometry>,
    tile_meshes: Query<&TileMeshMarker, Added<TileMeshMarker>>,
    terrain_data_requester: TileTerrainDataRequesterQuery,
) {
    let is_tile_meshes_empty = tile_meshes.is_empty();

    for (_, mut feature) in &mut renderable_features {
        match feature.as_ref() {
            RenderableFeature::Point {
                render_info,
                material,
                active,
                ..
            } => {
                if is_tile_meshes_empty && !render_info.should_recalculate_height {
                    continue;
                }
                if !material.show || !active {
                    continue;
                }
            }
            _ => continue,
        };

        match feature.as_mut() {
            RenderableFeature::Point {
                coordinates: _,
                crs: _,
                material,
                feature_id,
                render_info,
                geometry: transferable_geometry,
                ..
            } => {
                render_info.should_recalculate_height = false;
                let geometry = geometries.get(*feature_id).unwrap();
                if material.clamp_to_ground {
                    let terrain_height = compute_terrain_height_at_point(
                        &mut qt,
                        &mut buf,
                        &terrain_data_requester,
                        &geometry.crs.to_lng_lat(WGS84_64, geometry.coords),
                    )
                    .unwrap_or(0.);
                    render_info.current_terrain_height =
                        render_info.current_terrain_height.max(terrain_height);
                } else {
                    render_info.current_terrain_height = 0.;
                }
                let position = geometry.crs.to_vec3(
                    WGS84_64,
                    geometry.coords,
                    material.height + render_info.current_terrain_height as f32,
                );

                // Update RTE geometry position
                transferable_geometry.update_rte_position(&mut buf, position);
            }
            _ => unreachable!(),
        };
    }
}

#[allow(clippy::type_complexity)]
pub fn remove_batched_feature(
    mut commands: Commands,
    mut removed_renderable_features: Query<&mut RenderableFeature>,
    removed_features: Query<
        (Entity, &FeatureId, &GlobalBatchIds),
        (With<BatchedFeature>, With<PointMarker>, With<Deleted>),
    >,
    mut buf: ResMut<BufferStore>,
    mut batch_table_res: ResMut<BatchTable>,
    mut feature_batch_id_map: ResMut<FeatureBatchIdMap>,
) {
    for (feature_id, rendered_feature_id, global_batch_ids) in &removed_features {
        let Some(rendered_feature_id) = rendered_feature_id.0 else {
            unreachable!();
        };
        if let Ok(mut feature) = removed_renderable_features.get_mut(rendered_feature_id) {
            feature.destroy(&mut buf, &mut batch_table_res);
        }
        feature_batch_id_map.remove(&rendered_feature_id, &mut buf, &mut batch_table_res);
        buf.remove(&global_batch_ids.handle);
        commands.entity(feature_id).despawn();
    }
}
