use bevy_ecs::{
    entity::Entity,
    query::Added,
    system::{Commands, Query, ResMut},
};

use navara_buffer_store::BufferStore;
use navara_core::WGS84_32;
use navara_feature_component::{
    batch::{FeatureBatchId, FeatureBatchIdMap, GlobalBatchIdAndSelections},
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
            &GlobalBatchIdAndSelections,
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

        let position = geometry
            .crs
            .to_vec3(WGS84_32, geometry.coords, material.height);

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
            Some(a) => transform.mul_transform(*a),
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
                    should_recalculate_height: true,
                },
                bin: bin.cloned(),
                geometry: TransferableModelGeometry {
                    batch_id_and_selected_status: Some(TransferableFloatAttribute {
                        data: global_batch_ids.0,
                        size: 2,
                    }),
                },
                feature_batch_id: feature_batch_id.0,
                active: true,
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
