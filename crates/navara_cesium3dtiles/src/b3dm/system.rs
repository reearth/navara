//! B3DM standalone layer systems.
//!
//! These systems handle B3DM files loaded directly as layers (not via 3D Tiles).
//! The 3D Tiles pipeline uses the generic construct and cleanup systems instead.

use bevy_ecs::{
    entity::Entity,
    query::{Added, Changed, With, Without},
    system::{Commands, Query, Res, ResMut},
};
use navara_buffer_store::BufferStore;
use navara_component::{Deleted, Priority};
use navara_core::CRS;
use navara_data_requester::{DataRequester, DataRequesterExtension, DataRequesterStatus};
use navara_feature_component::{
    batch::{
        BatchProperty, BatchTable, BatchTableValue, FeatureBatchId, FeatureBatchIdMap,
        GlobalBatchIds,
    },
    model::{ModelBin, ModelGeometry, ModelMarker},
    render::RenderableFeature,
};
use navara_layer::{B3dmLayer, DeleteB3dmLayerMarker, LayerId, LayerStore, UpdateB3dmLayerMarker};
use navara_material::{Appearance, ModelMaterial};
use navara_math::{PI_OVER_TWO, Quat, Transform};

use super::parser::{generate_global_batch_ids, get_geometry_info_from_b3dm};
use super::requester::B3dmLayerDataRequesterMarker;

/// Spawns data requesters for standalone B3DM layers (not part of 3D Tiles).
pub fn request_model_by_b3dm_layer(
    mut commands: Commands,
    mut buf: ResMut<BufferStore>,
    b3dm_layers: Query<(Entity, &B3dmLayer), Added<B3dmLayer>>,
) {
    for (e, layer) in &b3dm_layers {
        commands.spawn((
            B3dmLayerDataRequesterMarker(e),
            Priority::Medium,
            DataRequester::from_store(
                layer.data.as_ref().unwrap().url.clone(),
                &mut buf,
                DataRequesterExtension::B3dm,
            ),
        ));
    }
}

#[allow(clippy::type_complexity)]
pub fn construct_model_by_b3dm_layer(
    mut commands: Commands,
    mut buf: ResMut<BufferStore>,
    mut batch_table_res: ResMut<BatchTable>,
    requesters: Query<
        (Entity, &B3dmLayerDataRequesterMarker, &DataRequester),
        (Changed<DataRequester>, Without<Deleted>),
    >,
    b3dm_layers: Query<&B3dmLayer>,
) {
    for (e, marker, req) in &requesters {
        if !matches!(req.status, DataRequesterStatus::Pending) {
            commands.entity(e).despawn();
        }

        // TODO: Handle fail
        if !matches!(req.status, DataRequesterStatus::Success) {
            continue;
        }
        let layer = match b3dm_layers.get(marker.0) {
            Ok(l) => l,
            Err(_) => unreachable!(),
        };
        let mut appearance = match &layer.appearances[0] {
            Appearance::Model(m) => m.clone(),
            _ => unimplemented!(),
        };
        appearance.should_rotate_in_default = false;

        let (center, glb_bin_handle, batch_table, batch_length) =
            match get_geometry_info_from_b3dm(&mut buf, req.handle) {
                Some(r) => r,
                None => continue,
            };

        let mut global_batch_ids = Vec::with_capacity(batch_length);
        generate_global_batch_ids(&mut batch_table_res, batch_length, &mut global_batch_ids);

        let feature_batch_id = if batch_length > 0 {
            {
                batch_table_res
                    .add(Some(BatchTableValue {
                        properties: Some(BatchProperty::Cesium3dTileset(batch_table)),
                        layer_id: Some(layer.layer_id.clone()),
                    }))
                    .unwrap_or(0)
            }
        } else {
            0
        };

        let batch_length = global_batch_ids.len();
        let ids_handle = buf.new_u32(global_batch_ids);

        commands.spawn((
            LayerId(layer.layer_id.to_owned()),
            FeatureBatchId(feature_batch_id),
            GlobalBatchIds {
                handle: ids_handle,
                batch_length: batch_length as u32,
            },
            ModelGeometry {
                coords: center,
                crs: CRS::Geocentric,
            },
            appearance,
            ModelBin(glb_bin_handle),
            // TODO: Check asset property in tileset.json.
            // TODO: Clamp the height to terrain height.
            Transform::from_rotation(Quat::from_rotation_x(PI_OVER_TWO)),
        ));

        buf.remove(&req.handle);
    }
}

pub fn update_model_by_b3dm_layer(
    mut commands: Commands,
    layer_store: Res<LayerStore>,
    updated: Query<(Entity, &UpdateB3dmLayerMarker)>,
    mut features: Query<&mut RenderableFeature>,
) {
    for (e, u) in &updated {
        let layer_id = u.layer_id.clone();
        if let Some(ids) = layer_store.get(&layer_id) {
            for id in ids {
                let mut f = match features.get_mut(*id) {
                    Ok(f) => f,
                    Err(_) => continue,
                };
                if let RenderableFeature::Model { material, .. } = f.as_mut() {
                    *material = u.material.clone();
                }
            }
        }
        commands.entity(e).despawn();
    }
}

#[allow(clippy::type_complexity, clippy::too_many_arguments)]
pub fn delete_model_by_b3dm_layer(
    mut commands: Commands,
    mut buf: ResMut<BufferStore>,
    mut batch_table_res: ResMut<BatchTable>,
    mut feature_batch_id_map: ResMut<FeatureBatchIdMap>,
    mut layer_store: ResMut<LayerStore>,
    deleted: Query<(Entity, &DeleteB3dmLayerMarker)>,
    b3dm_layers: Query<Entity, With<B3dmLayer>>,
    features: Query<
        (&ModelBin, &FeatureBatchId, &GlobalBatchIds),
        (
            With<LayerId>,
            With<ModelGeometry>,
            With<ModelMaterial>,
            With<Transform>,
        ),
    >,
    mut rendered_features: Query<(&ModelMarker, &mut RenderableFeature)>,
) {
    for (e, d) in &deleted {
        let entities = match layer_store.get(&d.0.clone()) {
            Some(e) => e,
            None => continue,
        };

        for e in entities {
            // if a model has batch table, its global batch ids will be removed here.
            feature_batch_id_map.remove(e, &mut buf, &mut batch_table_res);
            commands.entity(*e).despawn();

            if let Ok((_maker, mut feature)) = rendered_features.get_mut(*e)
                && let RenderableFeature::Model {
                    feature_id,
                    geometry,
                    ..
                } = &mut *feature
            {
                // if a model hasn't batch table, its global batch ids will be removed here.
                geometry.remove_from_buf(&mut buf, &mut batch_table_res);

                if let Ok((modebin, feature_batch_id, ..)) = features.get(*feature_id) {
                    batch_table_res.remove(&feature_batch_id.0);
                    buf.remove(&modebin.0);
                }
                commands.entity(*feature_id).despawn();
            }
        }

        for e in &b3dm_layers {
            commands.entity(e).despawn();
        }
        layer_store.remove(&d.0);
        commands.entity(e).despawn();
    }
}
