use bevy_ecs::{
    change_detection::DetectChanges,
    entity::Entity,
    query::{Added, With, Without},
    system::{Commands, Query, ResMut},
};
use navara_buffer_store::BufferStore;
use navara_component::Deleted;
use navara_core::{Aabb, CRS, WGS84_32};
use navara_feature_component::polygon::{
    construct_polygon_feature, PolygonGeometry, PolygonMarker, UpdatePolygon,
};
use navara_geometry::{Hierarchy, PolygonResource};
use navara_layer::{LayerId, LayerStore};
use navara_material::{PolygonInternalMaterial, PolygonMaterial};
use navara_math::{FloatType, Transform, Vec3};
use navara_tile_component::{
    sample_terrain_height_within_extent, RasterTileQuadtree, TileMeshMarker,
};

use navara_feature_component::{
    batch::BatchedFeature,
    id::FeatureId,
    render::{PolygonRenderInformation, RenderableFeature, TransferablePolygonGeometry},
    BatchedFeatureMarker,
};
use navara_worker::construct_polygon_batched_feature::{
    ConstructPolygonBatchedFeatureMarker, ConstructPolygonBatchedFeatureParameters,
    ConstructPolygonBatchedFeatureResult, ConstructPolygonBatchedFeatureWorkerTaskBundle,
};

#[allow(clippy::type_complexity)]
pub fn transfer_batched_mesh(
    mut commands: Commands,
    polygon: Query<(&LayerId, &PolygonMaterial)>,
    mut batched_features: Query<
        (Entity, &mut BatchedFeature, Option<&mut FeatureId>),
        With<PolygonMarker>,
    >,
    mut layer_store: ResMut<LayerStore>,
    construct_polygon_feature_tasks: Query<
        (Entity, &ConstructPolygonBatchedFeatureResult),
        Without<Deleted>,
    >,
) {
    for (batched_feature_entity, mut batched_feature, feature_id) in &mut batched_features {
        let needs_update = batched_feature.is_added()
            || batched_feature
                .construct_polygon_feature
                .map_or(false, |c: Entity| {
                    construct_polygon_feature_tasks.contains(c)
                });
        if !needs_update {
            continue;
        }

        if batched_feature.construct_polygon_feature.is_none() {
            let task_entity = commands
                .spawn(ConstructPolygonBatchedFeatureWorkerTaskBundle::new(
                    ConstructPolygonBatchedFeatureMarker,
                    ConstructPolygonBatchedFeatureParameters {
                        batched_feature: batched_feature_entity,
                    },
                ))
                .id();
            batched_feature.construct_polygon_feature = Some(task_entity);
            continue;
        }

        let (task_entity, ConstructPolygonBatchedFeatureResult { extent, geometry }) =
            construct_polygon_feature_tasks
                .get(batched_feature.construct_polygon_feature.unwrap())
                .unwrap();

        let (layer_id, material) = batched_feature
            .features
            .iter()
            .find_map(|e| polygon.get(*e).ok())
            .unwrap();

        let mut material = material.clone();
        material.internal = Some(PolygonInternalMaterial {
            min_max_heights: vec![0., 0.],
        });

        let aabb = Aabb::from_extent_f32(*extent, 0., 0.);
        let surface_point = WGS84_32.scale_to_geodetic_surface(aabb.center);

        let entity = commands
            .spawn((
                PolygonMarker,
                RenderableFeature::Polygon {
                    // TODO: Calculate coordinate to update transform
                    coordinates: Vec3::new(0., 0., 0.),
                    crs: CRS::Geocentric,
                    material,
                    geometry: geometry.clone(),
                    transform: Transform::default(),
                    feature_id: None,
                    render_info: PolygonRenderInformation {
                        should_recalculate_height: true,
                        distance_to_center_from_ellipsoid_surface: -aabb
                            .center
                            .distance(surface_point.unwrap()),
                    },
                    extent: *extent,
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
    mut polygon: Query<
        (
            Entity,
            &LayerId,
            Option<&mut FeatureId>,
            &mut PolygonGeometry,
            &PolygonMaterial,
        ),
        (Added<PolygonGeometry>, Without<BatchedFeatureMarker>),
    >,
    mut polygon_resource: ResMut<PolygonResource>,
    mut layer_store: ResMut<LayerStore>,
) {
    for (entity, layer_id, feature_id, geometry, material) in &mut polygon {
        let geometry_hierarchy =
            Hierarchy::from_transferred(&geometry.hierarchy, &mut buf).unwrap();
        let (extent_opt, polygon_result_opt) = construct_polygon_feature(
            geometry_hierarchy,
            &geometry.crs,
            material,
            &mut polygon_resource,
        );
        if let (Some(extent), Some(polygon_result)) = (extent_opt, polygon_result_opt) {
            let mut material = material.clone();
            material.internal = Some(PolygonInternalMaterial {
                min_max_heights: vec![0., 0.],
            });

            let aabb = Aabb::from_extent_f32(extent, 0., 0.);
            let surface_point = WGS84_32.scale_to_geodetic_surface(aabb.center);

            // TODO: Don't forget removing the stored data from BufferStore when the feature is removed.
            let entity = commands
                .spawn((
                    PolygonMarker,
                    RenderableFeature::Polygon {
                        // TODO: Calculate coordinate to update transform
                        coordinates: Vec3::new(0., 0., 0.),
                        crs: CRS::Geocentric,
                        material,
                        geometry: TransferablePolygonGeometry::with_buf(
                            &mut buf,
                            polygon_result.geometry,
                        ),
                        transform: Transform::default(),
                        feature_id: Some(entity),
                        render_info: PolygonRenderInformation {
                            should_recalculate_height: true,
                            distance_to_center_from_ellipsoid_surface: -aabb
                                .center
                                .distance(surface_point.unwrap()),
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

pub fn update_polygon(
    mut commands: Commands,
    updated_polygons: Query<(Entity, &UpdatePolygon), Added<UpdatePolygon>>,
    mut features: Query<&mut RenderableFeature>,
) {
    for (e, updated) in &updated_polygons {
        let mut f = match features.get_mut(updated.feature_id) {
            Ok(f) => f,
            Err(_) => continue,
        };
        let f = f.as_mut();

        if let RenderableFeature::Polygon {
            material,
            render_info,
            ..
        } = f
        {
            let should_recalculate_height = material.clamp_to_ground
                != updated.material.clamp_to_ground
                || material.height != updated.material.height
                || material.extruded_height != updated.material.extruded_height;
            let internal = material.internal.clone();
            *material = updated.material.clone();
            material.internal = internal;
            render_info.should_recalculate_height = should_recalculate_height;
        }
        commands.entity(e).remove::<UpdatePolygon>();
    }
}

// TODO: This system is executed whenever a tile is added.
//       This isn't efficient, so we need to update this system
//       to execute only when the layer's bounding box is within the camera frustum.
#[allow(clippy::too_many_arguments)]
pub fn update_height_by_terrain(
    mut qt: ResMut<RasterTileQuadtree>,
    mut renderable_features: Query<(&PolygonMarker, &mut RenderableFeature)>,
    tile_meshes: Query<&TileMeshMarker, Added<TileMeshMarker>>,
) {
    let is_tile_meshes_empty = tile_meshes.is_empty();

    for (_, mut feature) in &mut renderable_features {
        match feature.as_ref() {
            RenderableFeature::Polygon { render_info, .. } => {
                if is_tile_meshes_empty && !render_info.should_recalculate_height {
                    continue;
                }
            }
            _ => continue,
        };
        match feature.as_mut() {
            RenderableFeature::Polygon {
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
                    (material.height, material.extruded_height.unwrap_or(0.))
                };

                let internal = material.internal.as_mut().unwrap();
                internal.min_max_heights = calc_min_max_height(
                    min_height,
                    max_height,
                    material.clamp_to_ground,
                    render_info.distance_to_center_from_ellipsoid_surface,
                );
            }
            _ => unreachable!(),
        };
    }
}

fn calc_min_max_height(
    height: FloatType,
    extruded_height: FloatType,
    clamp_to_ground: bool,
    distance_to_center_from_ellipsoid_surface: FloatType,
) -> Vec<FloatType> {
    let height = if clamp_to_ground {
        height.min(distance_to_center_from_ellipsoid_surface)
    } else {
        height
    };
    let extruded_height = if clamp_to_ground {
        extruded_height
    } else {
        height + extruded_height
    };

    vec![height, extruded_height]
}
