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
    batch::BatchedFeature,
    id::FeatureId,
    polyline::construct_polyline_feature,
    render::{PolylineRenderInformation, RenderableFeature, TransferablePolylineGeometry},
    BatchedFeatureMarker,
};
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
    polylines: Query<(&LayerId, &PolylineMaterial)>,
    mut batched_features: Query<
        (Entity, &mut BatchedFeature, Option<&mut FeatureId>),
        With<PolylineMarker>,
    >,
    mut layer_store: ResMut<LayerStore>,
    construct_polyline_feature_tasks: Query<
        (Entity, &ConstructPolylineBatchedFeatureResult),
        Without<Deleted>,
    >,
) {
    for (batched_feature_entity, mut batched_feature, feature_id) in &mut batched_features {
        let needs_update = batched_feature.is_added()
            || batched_feature
                .construct_polyline_feature
                .map_or(false, |c| construct_polyline_feature_tasks.contains(c));
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

        let Ok((layer_id, material)) = polylines.get(*batched_feature.features.first().unwrap())
        else {
            continue;
        };

        let mut material = material.clone();
        material.internal = Some(PolylineInternalMaterial {
            min_max_heights: vec![0., 0.],
        });

        let entity = commands
            .spawn((
                PolylineMarker,
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
                    },
                },
            ))
            .id();

        if let Some(mut feature_id) = feature_id {
            feature_id.0 = Some(entity);
        }

        layer_store.add(layer_id.0.clone(), entity);

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
        ),
        (Added<PolylineGeometry>, Without<BatchedFeatureMarker>),
    >,
    mut layer_store: ResMut<LayerStore>,
) {
    for (entity, layer_id, feature_id, geometry, material) in &mut polylines {
        if let Some((extent, geometry)) = construct_polyline_feature(
            material,
            buf.remove_f32(&geometry.coords).unwrap(),
            &geometry.crs,
        ) {
            let mut material = material.clone();
            material.internal = Some(PolylineInternalMaterial {
                min_max_heights: vec![0., 0.],
            });

            let entity = commands
                .spawn((
                    PolylineMarker,
                    RenderableFeature::Polyline {
                        // TODO: Calculate coordinate to update transform
                        coordinates: Vec3::new(0., 0., 0.),
                        crs: CRS::Geocentric,
                        material,
                        geometry: TransferablePolylineGeometry::with_buf(&mut buf, geometry),
                        transform: Transform::default(),
                        feature_id: Some(entity),
                        render_info: PolylineRenderInformation {
                            should_recalculate_height: true,
                        },
                        extent,
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
            RenderableFeature::Polyline { render_info, .. } => {
                if is_tile_meshes_empty && !render_info.should_recalculate_height {
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
