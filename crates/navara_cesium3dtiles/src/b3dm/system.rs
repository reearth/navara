use bevy_ecs::{
    entity::Entity,
    query::{Added, Changed, With, Without},
    system::{Commands, Query, Res, ResMut},
};
use bevy_log::error;
use navara_buffer_store::{BufferStore, Handle};
use navara_component::{Deleted, Priority};
use navara_core::CRS;
use navara_data_requester::{DataRequester, DataRequesterExtension, DataRequesterStatus};
use navara_feature_component::{
    batch::BatchTable,
    batch::BatchTableValue,
    batch::FeatureBatchId,
    batch::FeatureBatchIdMap,
    batch::GlobalBatchIds,
    id::FeatureId,
    model::{ModelBin, ModelGeometry, ModelMarker},
    render::RenderableFeature,
};
use navara_layer::{
    B3dmLayer, Cesium3dTilesLayer, DeleteB3dmLayerMarker, LayerId, LayerStore,
    UpdateB3dmLayerMarker,
};
use navara_material::{Appearance, ModelMaterial};
use navara_math::{Quat, Transform, Vec3, PI_OVER_TWO};
use navara_parser::b3dm::BatchTable as B3dmBatchTable;
use navara_parser::{b3dm::B3dm, glb::BinaryReader};

use crate::{
    Cesium3dTileContentDataRequesterMarker, RenderedCesium3dTileContent, TileOrderByDistance,
};

use super::{
    requester::{B3dmDataRequesterMarker, B3dmLayerDataRequesterMarker},
    RenderedCesium3dTileContentB3dmMarker,
};

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

// TODO for GLB
// - We could use TextureFragment to fetch GLB.
// - However we might need to transform the position by the extension.
// FIXME: Store BatchTable to Bevy Resource.
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
            match get_geometry_info_from_b3dm(&mut buf, &req.handle) {
                Some(r) => r,
                None => continue,
            };

        let feature_batch_id = (batch_length > 0)
            .then(|| {
                batch_table_res
                    .add(BatchTableValue::Cesium3dTileset(batch_table))
                    .unwrap_or(0)
            })
            .unwrap_or(0);

        // batch_length.max(1): If there is no batch table, assign a global batch id to the entire model.
        let global_batch_ids = batch_table_res.add_multiple_null_val(batch_length.max(1));

        let ids_handle = buf.new_u32(global_batch_ids);

        commands.spawn((
            LayerId(layer.layer_id.to_owned()),
            FeatureBatchId(feature_batch_id),
            GlobalBatchIds(ids_handle),
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
        (&ModelBin, &FeatureBatchId, &LayerId, &GlobalBatchIds),
        (
            With<LayerId>,
            With<ModelGeometry>,
            With<ModelMaterial>,
            With<Transform>,
        ),
    >,
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
        }

        for (modebin, feature_batch_id, layer_id, global_batch_ids) in &features {
            if layer_id.0 == d.0 {
                batch_table_res.remove(&feature_batch_id.0);
                buf.remove(&modebin.0);

                // if a model hasn't batch table, its global batch ids will be removed here.
                if let Some(global_ids) = buf.get_u32(&global_batch_ids.0) {
                    // remove global batch ids from batch table
                    for id in global_ids {
                        batch_table_res.remove(id);
                    }
                }
                buf.remove(&global_batch_ids.0);
            }
        }

        for e in &b3dm_layers {
            commands.entity(e).despawn();
        }
        layer_store.remove(&d.0);
        commands.entity(e).despawn();
    }
}

pub fn construct_model_by_cesium3dtiles_layer(
    mut commands: Commands,
    mut buf: ResMut<BufferStore>,
    mut batch_table_res: ResMut<BatchTable>,
    requesters: Query<
        (
            &Cesium3dTileContentDataRequesterMarker,
            &B3dmDataRequesterMarker,
            &DataRequester,
        ),
        Without<Deleted>,
    >,
    mut rendered_tiles: Query<
        &mut RenderedCesium3dTileContent,
        (
            With<RenderedCesium3dTileContentB3dmMarker>,
            Added<RenderedCesium3dTileContent>,
        ),
    >,
    layers: Query<(Entity, &Cesium3dTilesLayer)>,
) {
    for mut tile in &mut rendered_tiles {
        let (_, _, req) = match requesters.get(tile.data_requester_id) {
            Ok(v) => v,
            Err(_) => continue,
        };
        // TODO: Handle fail
        if !matches!(req.status, DataRequesterStatus::Success) {
            continue;
        }
        let (_, layer) = match layers.get(tile.layer_id) {
            Ok(l) => l,
            Err(_) => continue,
        };
        let mut appearance = match &layer.appearances[0] {
            Appearance::Model(m) => m.clone(),
            _ => unimplemented!(),
        };
        appearance.should_rotate_in_default = false;
        appearance.clamp_to_ground = false;

        let (center, glb_bin_handle, batch_table, batch_length) =
            match get_geometry_info_from_b3dm(&mut buf, &req.handle) {
                Some(r) => r,
                None => continue,
            };

        let feature_batch_id = (batch_length > 0)
            .then(|| {
                batch_table_res
                    .add(BatchTableValue::Cesium3dTileset(batch_table))
                    .unwrap_or(0)
            })
            .unwrap_or(0);

        // batch_length.max(1): If there is no batch table, assign a global batch id to the entire model.
        let global_batch_ids = batch_table_res.add_multiple_null_val(batch_length.max(1));

        let ids_handle = buf.new_u32(global_batch_ids);

        let entity = commands.spawn((
            LayerId(layer.layer_id.to_owned()),
            FeatureId::default(),
            FeatureBatchId(feature_batch_id),
            GlobalBatchIds(ids_handle),
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
        tile.feature_id = Some(entity.id());

        buf.remove(&req.handle);
    }
}

fn get_geometry_info_from_b3dm(
    buf: &mut BufferStore,
    handle: &Handle,
) -> Option<(Vec3, Handle, B3dmBatchTable, usize)> {
    let b3dm_bin = buf.get_u8(handle)?;
    let b3dm = B3dm::from_data(b3dm_bin).unwrap();
    let center = match b3dm.glb.0.json_chunk.data["extensions"]["CESIUM_RTC"]["center"].as_array() {
        Some(a) => {
            let mut center = Vec::with_capacity(a.len());
            for v in a {
                match v.as_f64() {
                    Some(v) => center.push(v),
                    None => continue,
                }
            }
            center
        }
        None => {
            error!("CESIUM_RTC could not find");
            return None;
        }
    };
    let glb_bin = match b3dm.extract_glb(b3dm_bin) {
        Ok(b) => b,
        Err(_) => unreachable!("B3DM should contain GLB"),
    };

    let glb_bin_handle = buf.new_u8(glb_bin);

    // NOTE: B3DM buffer is removed here to prevent duplicating data.
    buf.remove(handle);

    let batch_length = b3dm.feature_table.json.batch_length.unwrap() as usize;

    Some((
        Vec3::new(center[0] as f32, center[1] as f32, center[2] as f32),
        glb_bin_handle,
        b3dm.batch_table,
        batch_length,
    ))
}

#[allow(clippy::type_complexity, clippy::too_many_arguments)]
pub fn remove_invisible_rendered_tiles(
    mut commands: Commands,
    mut buf: ResMut<BufferStore>,
    mut batch_table_res: ResMut<BatchTable>,
    mut feature_batch_id_map: ResMut<FeatureBatchIdMap>,
    requesters: Query<
        &DataRequester,
        (
            With<Cesium3dTileContentDataRequesterMarker>,
            With<B3dmDataRequesterMarker>,
            Without<Deleted>,
        ),
    >,
    rendered_tiles: Query<
        (Entity, &RenderedCesium3dTileContent, &TileOrderByDistance),
        With<RenderedCesium3dTileContentB3dmMarker>,
    >,
    features: Query<
        (&FeatureId, &ModelBin, &FeatureBatchId, &GlobalBatchIds),
        (
            With<LayerId>,
            With<ModelGeometry>,
            With<ModelMaterial>,
            With<Transform>,
        ),
    >,
    rendered_features: Query<(&ModelMarker, &RenderableFeature)>,
) {
    for (entity, tile, _) in &rendered_tiles {
        if tile.is_visible {
            continue;
        }

        if let Some(feature_id) = tile.feature_id {
            // Remove feature
            if let Ok((rendered_feature_id, model_bin, feature_batch_id, global_batch_ids)) =
                features.get(feature_id)
            {
                if let Some(rendered_feature_id) = rendered_feature_id.0 {
                    if !rendered_features.contains(rendered_feature_id) {
                        continue;
                    }

                    // if a model has batch table, its global batch ids will be removed here.
                    if feature_batch_id_map.remove(
                        &rendered_feature_id,
                        &mut buf,
                        &mut batch_table_res,
                    ) {
                        batch_table_res.remove(&feature_batch_id.0);
                    } else {
                        // if a model hasn't batch table, its global batch ids will be removed here.
                        if let Some(global_ids) = buf.get_u32(&global_batch_ids.0) {
                            // remove global batch ids from batch table
                            for id in global_ids {
                                batch_table_res.remove(id);
                            }
                        }
                        buf.remove(&global_batch_ids.0);
                    }

                    buf.remove(&model_bin.0);
                    commands.entity(feature_id).despawn();
                    commands.entity(rendered_feature_id).despawn();
                } else {
                    continue;
                }
            } else {
                continue;
            }
        } else {
            continue;
        }

        // Remove data requester
        if let Ok(requester) = requesters.get(tile.data_requester_id) {
            buf.remove(&requester.handle);
            commands.entity(tile.data_requester_id).insert(Deleted);
        }

        commands.entity(entity).despawn();
    }
}
