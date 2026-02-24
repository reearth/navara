use bevy_ecs::{
    entity::Entity,
    query::{Added, With, Without},
    system::{Commands, Query, ResMut},
};
use navara_buffer_store::BufferStore;
use navara_component::Deleted;
use navara_feature_component::{
    batch::{
        BatchIndex, BatchTable, BatchedFeature, FeatureBatchId, FeatureBatchIdMap, GlobalBatchIds,
    },
    id::FeatureId,
    render::{RenderInformation, RenderableFeature},
    BatchedFeatureMarker,
};
use navara_layer::{LayerId, LayerStore};
use navara_material::BillboardMaterial;
use navara_math::Vec3;

use navara_tile_component::{
    RasterTileQuadtree, TileExtent, TileMeshMarker, TileTerrainDataRequesterQuery,
};

use navara_feature_component::billboard::{BillboardGeometry, BillboardMarker};

use crate::geometry::point::{
    build_transform, compute_rtc_center, resolve_terrain_height, PositionBuffer,
};

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
            &GlobalBatchIds,
            &mut FeatureId,
            Option<&TileExtent>,
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
        tile_extent_component,
    ) in &mut batched_features
    {
        let feature_len = batched_feature.features.len();
        let mut batch_indices = Vec::with_capacity(feature_len);
        let mut batch_ids = Vec::with_capacity(feature_len);
        let mut crs = None;

        let Some(global_ids) = buf.get_u32(&global_batch_ids.handle) else {
            continue;
        };

        let rtc_center = compute_rtc_center(tile_extent_component);
        let mut positions = PositionBuffer::new(rtc_center, feature_len);

        // TODO: Remove this iteration
        for feature_entity in &batched_feature.features {
            let (point_geometry, batch_index) = points.get(*feature_entity).unwrap();

            if crs.is_none() {
                crs = Some(point_geometry.crs.clone());
            }

            positions.push_from_crs(
                point_geometry.coords,
                &point_geometry.crs,
                material.height,
                0.0,
            );

            batch_indices.push(batch_index.0);
            let global_index = batch_index.0 as usize;
            batch_ids.push(global_ids[global_index] as f32);
        }

        let crs = crs.unwrap();

        let geometry = positions.transfer(&mut buf, batch_indices, batch_ids);
        let transform = build_transform(rtc_center, material.size);

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
                    transform,
                    feature_id: batched_feature_entity,
                    render_info: RenderInformation {
                        current_terrain_height: 0.,
                        is_rendered: false,
                        should_recalculate_height: true,
                    },
                    geometry,
                    active: batched_feature.default_active,
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

// TODO: We might get the terrain height in the shader from a depth buffer.
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
                if !render_info.is_rendered {
                    continue;
                }
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
            RenderableFeature::Billboard {
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
                let rtc_center = if geometry.position_3d_high.is_some() {
                    None
                } else {
                    Some(transform.translation)
                };
                let mut positions = PositionBuffer::new(rtc_center, feature_len);

                for feature_entity in &batched_feature.features {
                    let geom = geometries.get(*feature_entity).unwrap();
                    let terrain_height = resolve_terrain_height(
                        geom.coords,
                        &geom.crs,
                        material.clamp_to_ground,
                        &mut qt,
                        &mut buf,
                        &terrain_data_requester,
                    );
                    render_info.current_terrain_height = terrain_height;
                    positions.push_from_crs(
                        geom.coords,
                        &geom.crs,
                        material.height,
                        terrain_height,
                    );
                }

                positions.apply_to(&mut buf, geometry);
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
        (With<BatchedFeature>, With<BillboardMarker>, With<Deleted>),
    >,
    mut buf: ResMut<BufferStore>,
    mut batch_table_res: ResMut<BatchTable>,
    mut feature_batch_id_map: ResMut<FeatureBatchIdMap>,
) {
    for (feature_id, rendered_feature_id, global_batch_ids) in &removed_features {
        // Clean up RenderableFeature if it exists
        if let Some(rendered_feature_id) = rendered_feature_id.0 {
            if let Ok(mut feature) = removed_renderable_features.get_mut(rendered_feature_id) {
                feature.destroy(&mut buf, &mut batch_table_res);
            }
            feature_batch_id_map.remove(&rendered_feature_id, &mut buf, &mut batch_table_res);
            // Mark RenderableFeature as Deleted so event::despawn will clean it up
            commands.entity(rendered_feature_id).insert(Deleted);
        }

        // Always clean up GlobalBatchIds and despawn the BatchedFeature entity
        buf.remove(&global_batch_ids.handle);
        commands.entity(feature_id).despawn();
    }
}

#[allow(clippy::type_complexity)]
pub fn cleanup_deleted_batched_children(
    mut commands: Commands,
    deleted: Query<
        Entity,
        (
            With<BillboardGeometry>,
            With<BatchedFeatureMarker>,
            With<Deleted>,
        ),
    >,
) {
    for entity in &deleted {
        commands.entity(entity).despawn();
    }
}
