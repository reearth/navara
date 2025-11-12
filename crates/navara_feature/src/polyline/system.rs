use bevy_ecs::{
    change_detection::DetectChanges,
    entity::Entity,
    query::{Added, With, Without},
    system::{Commands, Query, ResMut},
};
use navara_buffer_store::BufferStore;
use navara_component::Deleted;
use navara_core::CRS;
use navara_feature_component::{
    batch::{
        BatchId, BatchTable, BatchedFeature, FeatureBatchId, FeatureBatchIdMap, GlobalBatchIds,
    },
    id::FeatureId,
    polyline::construct_polyline_feature,
    render::{PolylineRenderInformation, RenderableFeature, TransferablePolylineGeometry},
    BatchedFeatureMarker,
};
use navara_geometry::FloatAttribute;
use navara_layer::{LayerId, LayerStore};
use navara_material::{PolylineInternalMaterial, PolylineMaterial};
use navara_math::{Transform, Vec3};

use navara_feature_component::polyline::{PolylineGeometry, PolylineMarker};
use navara_tile_component::{
    sample_terrain_height_within_extent, RasterTileQuadtree, TileMeshMarker,
};
use navara_worker::construct_polyline_batched_feature::{
    ConstructPolylineBatchedFeatureMarker, ConstructPolylineBatchedFeatureParameters,
    ConstructPolylineBatchedFeatureResult, ConstructPolylineBatchedFeatureWorkerTaskBundle,
};

#[allow(clippy::type_complexity)]
pub fn transfer_batched_mesh(
    mut commands: Commands,
    mut feature_batch_id_map: ResMut<FeatureBatchIdMap>,
    mut batched_features: Query<
        (
            Entity,
            &LayerId,
            &PolylineMaterial,
            &mut BatchedFeature,
            &FeatureBatchId,
            &GlobalBatchIds,
            Option<&mut FeatureId>,
        ),
        With<PolylineMarker>,
    >,
    mut layer_store: ResMut<LayerStore>,
    construct_polyline_feature_tasks: Query<
        (Entity, &ConstructPolylineBatchedFeatureResult),
        Without<Deleted>,
    >,
) {
    for (
        batched_feature_entity,
        layer_id,
        material,
        mut batched_feature,
        feature_batch_id,
        global_batch_ids,
        feature_id,
    ) in &mut batched_features
    {
        let needs_update = batched_feature.is_added()
            || batched_feature.construct_polyline_feature.is_some_and(|c| {
                construct_polyline_feature_tasks.contains(c)
                    && feature_id.as_ref().is_none_or(|f| f.0.is_none())
            });
        if !needs_update {
            continue;
        }

        if batched_feature.construct_polyline_feature.is_none() {
            let task_entity = commands
                .spawn(ConstructPolylineBatchedFeatureWorkerTaskBundle::new(
                    ConstructPolylineBatchedFeatureMarker,
                    ConstructPolylineBatchedFeatureParameters {
                        batched_feature: batched_feature_entity,
                    },
                ))
                .id();
            batched_feature.construct_polyline_feature = Some(task_entity);
            continue;
        }

        let (task_entity, ConstructPolylineBatchedFeatureResult { extent, geometry }) =
            construct_polyline_feature_tasks
                .get(batched_feature.construct_polyline_feature.unwrap())
                .unwrap();

        let mut material = material.clone();
        material.internal = Some(PolylineInternalMaterial {
            min_max_heights: vec![0., 0.],
        });

        let entity = commands
            .spawn((
                PolylineMarker,
                layer_id.clone(),
                RenderableFeature::Polyline {
                    // TODO: Calculate coordinate to update transform
                    coordinates: Vec3::new(0., 0., 0.),
                    crs: CRS::Geocentric,
                    material,
                    geometry: geometry.clone(),
                    extent: *extent,
                    transform: Transform::default(),
                    feature_id: None,
                    render_info: PolylineRenderInformation {
                        should_recalculate_height: true,
                        is_rendered: false,
                    },
                    active: false,
                    feature_batch_id: feature_batch_id.0,
                    batch_length: global_batch_ids.batch_length,
                },
            ))
            .id();

        if let Some(mut feature_id) = feature_id {
            feature_id.0 = Some(entity);
        }

        layer_store.add(layer_id.0.clone(), entity);

        feature_batch_id_map.add(entity, global_batch_ids.clone());

        commands.entity(task_entity).insert(Deleted);
    }
}

#[allow(clippy::type_complexity)]
pub fn transfer_mesh(
    mut commands: Commands,
    mut buf: ResMut<BufferStore>,
    mut polylines: Query<
        (
            Entity,
            &LayerId,
            Option<&mut FeatureId>,
            &PolylineGeometry,
            &PolylineMaterial,
            &BatchId,
        ),
        (Added<PolylineGeometry>, Without<BatchedFeatureMarker>),
    >,
    mut layer_store: ResMut<LayerStore>,
) {
    for (entity, layer_id, feature_id, geometry, material, batch_id) in &mut polylines {
        // `coords` has a lifetime for sure.
        let constructed_feature = {
            let coords = buf.remove_f64(&geometry.coords).unwrap();
            construct_polyline_feature(material, coords, &geometry.crs)
        };

        if let Some((extent, mut geometry)) = constructed_feature {
            let mut material = material.clone();
            material.internal = Some(PolylineInternalMaterial {
                min_max_heights: vec![0., 0.],
            });

            let pos_cnt = geometry.attributes.position.data.len()
                / geometry.attributes.position.size as usize;
            let batch_id_vec = vec![batch_id.0; pos_cnt];

            geometry.attributes.batch_ids = Some(FloatAttribute::new(batch_id_vec, 1));

            let clamp_to_ground = material.clamp_to_ground;
            let entity = commands
                .spawn((
                    PolylineMarker,
                    layer_id.clone(),
                    RenderableFeature::Polyline {
                        // TODO: Calculate coordinate to update transform
                        coordinates: Vec3::new(0., 0., 0.),
                        crs: CRS::Geocentric,
                        material,
                        geometry: TransferablePolylineGeometry::with_buf(&mut buf, geometry),
                        transform: Transform::default(),
                        feature_id: Some(entity),
                        render_info: PolylineRenderInformation {
                            should_recalculate_height: clamp_to_ground,
                            is_rendered: false,
                        },
                        extent,
                        active: true,
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
}

// TODO: This system is executed whenever a tile is added.
//       This isn't efficient, so we need to update this system
//       to execute only when the layer's bounding box is within the camera frustum.
#[allow(clippy::too_many_arguments)]
pub fn update_height_by_terrain(
    mut qt: ResMut<RasterTileQuadtree>,
    mut renderable_features: Query<(&PolylineMarker, &mut RenderableFeature)>,
    tile_meshes: Query<&TileMeshMarker, Added<TileMeshMarker>>,
) {
    let is_tile_meshes_empty = tile_meshes.is_empty();

    for (_, mut feature) in &mut renderable_features {
        match feature.as_ref() {
            RenderableFeature::Polyline {
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
            RenderableFeature::Polyline {
                material,
                extent,
                render_info,
                ..
            } => {
                render_info.should_recalculate_height = false;

                let (min_height, max_height) = if material.clamp_to_ground {
                    let (min, max) = sample_terrain_height_within_extent(&mut qt, *extent);
                    (min, max)
                } else {
                    (0., 0.)
                };

                let internal = material.internal.as_mut().unwrap();
                internal.min_max_heights = vec![min_height, max_height];
            }
            _ => unreachable!(),
        };
    }
}

#[allow(clippy::type_complexity)]
#[allow(clippy::type_complexity)]
pub fn remove_batched_feature(
    mut commands: Commands,
    mut removed_renderable_features: Query<&mut RenderableFeature>,
    removed_features: Query<
        (Entity, &FeatureId, &GlobalBatchIds),
        (With<BatchedFeature>, With<PolylineMarker>, With<Deleted>),
    >,
    mut buf: ResMut<BufferStore>,
    mut batch_table_res: ResMut<BatchTable>,
    mut feature_batch_id_map: ResMut<FeatureBatchIdMap>,
) {
    for (feature_id, rendered_feature_id, global_batch_ids) in &removed_features {
        let Some(rendered_feature_id) = rendered_feature_id.0 else {
            continue;
        };
        if let Ok(mut feature) = removed_renderable_features.get_mut(rendered_feature_id) {
            feature.destroy(&mut buf, &mut batch_table_res);
        }
        feature_batch_id_map.remove(&rendered_feature_id, &mut buf, &mut batch_table_res);
        buf.remove(&global_batch_ids.handle);

        commands.entity(feature_id).despawn();
    }
}
