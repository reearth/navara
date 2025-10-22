use bevy_ecs::{
    entity::Entity,
    query::{Added, With},
    system::{Commands, Query, ResMut},
};

use navara_buffer_store::BufferStore;
use navara_component::Deleted;
use navara_core::WGS84_32;
use navara_feature_component::{
    batch::{BatchTable, FeatureBatchId, FeatureBatchIdMap, GlobalBatchIds},
    id::FeatureId,
    render::{ModelRenderInformation, RenderableFeature, TransferableModelGeometry},
    DeletedFeatureMarker,
};
use navara_layer::{LayerId, LayerStore};
use navara_material::ModelMaterial;
use navara_math::{Quat, Transform, Vec3};
use navara_tile_component::{
    compute_terrain_height_at_point, RasterTileQuadtree, TileMeshMarker,
    TileTerrainDataRequesterQuery,
};

use navara_feature_component::model::{ModelBin, ModelGeometry, ModelMarker};

use navara_geometry::TransferableFloatAttribute;

#[allow(clippy::type_complexity)]
pub fn transfer_mesh(
    mut commands: Commands,
    mut feature_batch_id_map: ResMut<FeatureBatchIdMap>,
    mut models: Query<
        (
            Entity,
            &LayerId,
            &FeatureBatchId,
            &GlobalBatchIds,
            Option<&mut FeatureId>,
            &ModelGeometry,
            &ModelMaterial,
            // For GLB
            Option<&ModelBin>,
            Option<&Transform>,
            // For glTF
            // Option<&ModelJson>,
            Option<&DeletedFeatureMarker>,
        ),
        Added<ModelGeometry>,
    >,
    mut layer_store: ResMut<LayerStore>,
) {
    for (
        entity,
        layer_id,
        feature_batch_id,
        global_batch_ids,
        mut feature_id,
        geometry,
        material,
        bin,
        adjustment_transform,
        deleted_marker,
    ) in &mut models
    {
        if deleted_marker.is_some() {
            continue;
        }

        let position: Vec3;
        if material.point_cloud {
            position = geometry.coords;
        } else {
            position = geometry
                .crs
                .to_vec3(WGS84_32, geometry.coords, material.height);
        }

        let transform = if material.should_rotate_in_default {
            let lnglat = geometry.crs.to_lng_lat(WGS84_32, geometry.coords);
            let lng = lnglat.lng.val();
            let lat = lnglat.lat.val();
            let rotation_y = Quat::from_rotation_y(-lat);
            let rotation_z = Quat::from_rotation_z(lng);
            let adjust_model = Quat::from_rotation_z(-std::f32::consts::PI / 2.0);
            let rotation = rotation_z * rotation_y * adjust_model;
            Transform::from_translation(position)
                .with_rotation(rotation)
                .with_scale(Vec3::new(material.size, material.size, material.size))
        } else {
            Transform::from_translation(position).with_scale(Vec3::new(
                material.size,
                material.size,
                material.size,
            ))
        };
        let transform = match adjustment_transform {
            Some(a) => if material.point_cloud {
                a.mul_transform(transform)
            } else {
                transform.mul_transform(*a)
            },
            None => transform,
        };

        let entity = commands.spawn((
            ModelMarker,
            layer_id.clone(),
            RenderableFeature::Model {
                coordinates: geometry.coords,
                crs: geometry.crs.clone(),
                material: material.clone(),
                transform,
                feature_id: entity,
                render_info: ModelRenderInformation {
                    current_terrain_height: 0.,
                    is_rendered: false,
                    should_recalculate_height: material.clamp_to_ground,
                },
                bin: bin.cloned(),
                geometry: TransferableModelGeometry {
                    batch_ids: Some(TransferableFloatAttribute {
                        data: global_batch_ids.handle,
                        size: 1,
                    }),
                },
                feature_batch_id: feature_batch_id.0,
                active: true,
                batch_length: global_batch_ids.batch_length,
            },
        ));

        if let Some(f) = feature_id.as_mut() {
            f.0 = Some(entity.id());
        }

        layer_store.add(layer_id.0.clone(), entity.id());

        feature_batch_id_map.add(entity.id(), global_batch_ids.clone());
    }
}

#[allow(clippy::too_many_arguments, clippy::type_complexity)]
pub fn update_height_by_terrain(
    mut qt: ResMut<RasterTileQuadtree>,
    mut buf: ResMut<BufferStore>,
    mut renderable_features: Query<(&ModelMarker, &mut RenderableFeature)>,
    geometries: Query<&ModelGeometry>,
    tile_meshes: Query<&TileMeshMarker, Added<TileMeshMarker>>,
    terrain_data_requester: TileTerrainDataRequesterQuery,
) {
    let is_tile_meshes_empty = tile_meshes.is_empty();

    for (_, mut feature) in &mut renderable_features {
        match feature.as_ref() {
            RenderableFeature::Model {
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
            RenderableFeature::Model {
                coordinates: _,
                crs: _,
                material,
                transform,
                feature_id,
                render_info,
                bin: _,
                geometry: _,
                feature_batch_id: _,
                ..
            } => {
                render_info.should_recalculate_height = false;
                let geometry = match geometries.get(*feature_id) {
                    Ok(g) => g,
                    Err(_) => continue,
                };
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
                };
                let position = geometry.crs.to_vec3(
                    WGS84_32,
                    geometry.coords,
                    material.height + render_info.current_terrain_height,
                );

                transform.translation = position;
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
        (
            Entity,
            &FeatureId,
            &ModelBin,
            Option<&FeatureBatchId>,
            Option<&GlobalBatchIds>,
        ),
        With<Deleted>,
    >,
    mut buf: ResMut<BufferStore>,
    mut batch_table_res: ResMut<BatchTable>,
    mut feature_batch_id_map: ResMut<FeatureBatchIdMap>,
) {
    for (feature_id, rendered_feature_id, model_bin, feature_batch_id, global_batch_ids) in
        &removed_features
    {
        let Some(rendered_feature_id) = rendered_feature_id.0 else {
            continue;
        };
        // if a model has batch table, its global batch ids will be removed here.
        feature_batch_id_map.remove(&rendered_feature_id, &mut buf, &mut batch_table_res);
        if let Some(global_batch_ids) = global_batch_ids {
            buf.remove(&global_batch_ids.handle);
        }
        if let Some(feature_batch_id) = feature_batch_id {
            batch_table_res.remove(&feature_batch_id.0);
        }
        if let Ok(mut feature) = removed_renderable_features.get_mut(rendered_feature_id) {
            feature.destroy(&mut buf, &mut batch_table_res);
        }

        buf.remove(&model_bin.0);
        commands.entity(feature_id).despawn();
    }
}
