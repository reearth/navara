use bevy_ecs::{
    entity::Entity,
    query::{Added, With, Without},
    system::{Commands, Query, ResMut},
};
use navara_buffer_store::BufferStore;
use navara_component::Deleted;
use navara_core::WGS84_32;
use navara_feature_component::{
    batch::{
        BatchId, BatchIndex, BatchTable, BatchedFeature, FeatureBatchId, FeatureBatchIdMap,
        GlobalBatchIdAndSelections, IdPropertyTable,
    },
    id::FeatureId,
    render::{RenderInformation, RenderableFeature, TransferablePointGeometry},
    BatchedFeatureMarker, LODFeatureMarker,
};
use navara_layer::{LayerId, LayerStore};
use navara_material::BillboardMaterial;
use navara_math::{Transform, Vec3};
use navara_tile_component::{
    compute_terrain_height_at_point, RasterTileQuadtree, TileMeshMarker,
    TileTerrainDataRequesterQuery,
};

use navara_feature_component::billboard::{BillboardGeometry, BillboardMarker};

#[allow(clippy::type_complexity)]
pub fn transfer_batched_mesh(
    mut commands: Commands,
    mut feature_batch_id_map: ResMut<FeatureBatchIdMap>,
    mut batched_features: Query<
        (
            Entity,
            &LayerId,
            &BillboardMaterial,
            &BatchedFeature,
            &FeatureBatchId,
            &GlobalBatchIdAndSelections,
            &mut FeatureId,
        ),
        (
            With<BillboardMarker>,
            Added<BatchedFeature>,
            Without<Deleted>,
        ),
    >,
    points: Query<(&BillboardGeometry, &BatchIndex)>,
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
    ) in &mut batched_features
    {
        // Extract all point geometries and create batch indices and IDs in a single loop
        let feature_len = batched_feature.features.len();
        let mut all_coords = Vec::with_capacity(feature_len * 3);
        let mut batch_indices = Vec::with_capacity(feature_len);
        let mut batch_ids_and_sels = Vec::with_capacity(feature_len * 2);
        let mut crs = None;

        // Get the global batch IDs from the buffer store
        let Some(global_ids) = buf.get_u32(&global_batch_ids.handle) else {
            continue;
        };

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
                    .to_vec3(WGS84_32, point_geometry.coords, material.height);

            all_coords.push(transformed_pos.x);
            all_coords.push(transformed_pos.y);
            all_coords.push(transformed_pos.z);

            // Add batch index
            batch_indices.push(batch_index.0);

            // Add batch ID and selection status
            let global_index = (batch_index.0 * 2) as usize;
            batch_ids_and_sels.push(global_ids[global_index] as f32); // batch ID
            batch_ids_and_sels.push(global_ids[global_index + 1] as f32); // selection status
        }

        let crs = crs.unwrap();

        // Create the renderable feature entity
        let entity = commands
            .spawn((
                BillboardMarker,
                BatchedFeatureMarker,
                layer_id.clone(),
                RenderableFeature::Billboard {
                    coordinates: Vec3::ZERO, // Not used for batched features
                    crs,
                    material: material.clone(),
                    transform: Transform::from_scale(Vec3::new(
                        material.size,
                        material.size,
                        material.size,
                    )),
                    feature_id: batched_feature_entity,
                    render_info: RenderInformation {
                        current_terrain_height: 0.,
                        is_rendered: false,
                        should_recalculate_height: true,
                    },
                    geometry: TransferablePointGeometry::with_buf(
                        &mut buf,
                        all_coords,
                        batch_indices,
                        batch_ids_and_sels,
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
    mut billboards: Query<
        (
            Entity,
            &LayerId,
            &BatchId,
            Option<&mut FeatureId>,
            &BillboardGeometry,
            &BillboardMaterial,
            Option<&LODFeatureMarker>,
        ),
        Added<BillboardGeometry>,
    >,
    mut layer_store: ResMut<LayerStore>,
) {
    for (entity, layer_id, batch_id, feature_id, geometry, material, lod_marker) in &mut billboards
    {
        let position = geometry
            .crs
            .to_vec3(WGS84_32, geometry.coords, material.height);

        let entity = commands
            .spawn((
                BillboardMarker,
                layer_id.clone(),
                RenderableFeature::Billboard {
                    coordinates: geometry.coords,
                    crs: geometry.crs.clone(),
                    material: material.clone(),
                    transform: Transform::from_translation(position).with_scale(Vec3::new(
                        material.size,
                        material.size,
                        material.size,
                    )),
                    feature_id: entity,
                    render_info: RenderInformation {
                        current_terrain_height: 0.,
                        is_rendered: false,
                        should_recalculate_height: true,
                    },
                    geometry: TransferablePointGeometry::with_buf(
                        &mut buf,
                        position.to_array().to_vec(),
                        vec![0],
                        batch_id.0.to_array().to_vec(),
                    ),
                    active: lod_marker.is_none(),
                    feature_batch_id: batch_id.0.x as u32,
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
        (&BillboardMarker, &mut RenderableFeature),
        With<BatchedFeatureMarker>,
    >,
    batched_features: Query<&BatchedFeature, (With<BillboardMarker>, Without<Deleted>)>,
    geometries: Query<&BillboardGeometry>,
    tile_meshes: Query<&TileMeshMarker, Added<TileMeshMarker>>,
    terrain_data_requester: TileTerrainDataRequesterQuery,
) {
    let is_tile_meshes_empty = tile_meshes.is_empty();

    for (_, mut feature) in &mut renderable_features {
        match feature.as_ref() {
            RenderableFeature::Billboard {
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
            RenderableFeature::Billboard {
                coordinates: _,
                crs: _,
                material,
                feature_id,
                render_info,
                geometry,
                ..
            } => {
                render_info.should_recalculate_height = false;
                let Ok(batched_feature) = batched_features.get(*feature_id) else {
                    continue;
                };

                let feature_len = batched_feature.features.len();
                let mut all_coords = Vec::with_capacity(feature_len * 3);

                for feature_id in &batched_feature.features {
                    let geometry = geometries.get(*feature_id).unwrap();
                    if material.clamp_to_ground {
                        let terrain_height = compute_terrain_height_at_point(
                            &mut qt,
                            &mut buf,
                            &terrain_data_requester,
                            &geometry.crs.to_lng_lat(WGS84_32, geometry.coords),
                        )
                        .unwrap_or(0.);
                        render_info.current_terrain_height =
                            render_info.current_terrain_height.max(terrain_height);
                    } else {
                        render_info.current_terrain_height = 0.;
                    }
                    let position = geometry.crs.to_vec3(
                        WGS84_32,
                        geometry.coords,
                        material.height + render_info.current_terrain_height,
                    );

                    all_coords.push(position.x);
                    all_coords.push(position.y);
                    all_coords.push(position.z);
                }

                buf.remove(&geometry.position.data);

                geometry.position.data = buf.new_f32(all_coords);
            }
            _ => unreachable!(),
        };
    }
}

#[allow(clippy::too_many_arguments, clippy::type_complexity)]
pub fn update_height_by_terrain(
    mut qt: ResMut<RasterTileQuadtree>,
    mut buf: ResMut<BufferStore>,
    mut renderable_features: Query<
        (&BillboardMarker, &mut RenderableFeature),
        Without<BatchedFeatureMarker>,
    >,
    geometries: Query<&BillboardGeometry>,
    tile_meshes: Query<&TileMeshMarker, Added<TileMeshMarker>>,
    terrain_data_requester: TileTerrainDataRequesterQuery,
) {
    let is_tile_meshes_empty = tile_meshes.is_empty();

    for (_, mut feature) in &mut renderable_features {
        match feature.as_ref() {
            RenderableFeature::Billboard {
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
            RenderableFeature::Billboard {
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
                        &geometry.crs.to_lng_lat(WGS84_32, geometry.coords),
                    )
                    .unwrap_or(0.);
                    render_info.current_terrain_height =
                        render_info.current_terrain_height.max(terrain_height);
                } else {
                    render_info.current_terrain_height = 0.;
                }
                let position = geometry.crs.to_vec3(
                    WGS84_32,
                    geometry.coords,
                    material.height + render_info.current_terrain_height,
                );

                transferable_geometry.position.data = buf.new_f32(position.to_array().to_vec());
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
        (Entity, &FeatureId, &GlobalBatchIdAndSelections),
        (With<BatchedFeature>, With<BillboardMarker>, With<Deleted>),
    >,
    mut buf: ResMut<BufferStore>,
    mut batch_table_res: ResMut<BatchTable>,
    mut id_prop_table_res: ResMut<IdPropertyTable>,
    mut feature_batch_id_map: ResMut<FeatureBatchIdMap>,
) {
    for (feature_id, rendered_feature_id, global_batch_id_and_selections) in &removed_features {
        let Some(rendered_feature_id) = rendered_feature_id.0 else {
            unreachable!();
        };
        if let Ok(mut feature) = removed_renderable_features.get_mut(rendered_feature_id) {
            feature.destroy(&mut buf, &mut batch_table_res, &mut id_prop_table_res);
        }
        feature_batch_id_map.remove(
            &rendered_feature_id,
            &mut buf,
            &mut batch_table_res,
            &mut id_prop_table_res,
        );
        buf.remove(&global_batch_id_and_selections.handle);
        commands.entity(feature_id).despawn();
    }
}
