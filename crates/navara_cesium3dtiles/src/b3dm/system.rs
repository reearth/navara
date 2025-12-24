//! B3DM (Batched 3D Model) Tile Processing
//!
//! This module handles loading and rendering of B3DM tiles, which contain
//! batched 3D models with per-feature metadata (batch tables).
//!
//! # B3DM Format
//!
//! B3DM files contain:
//! - Feature table (per-point metadata like batch length)
//! - Batch table (per-feature properties for styling/picking)
//! - Embedded GLB model data
//! - CESIUM_RTC extension for relative-to-center coordinates
//!
//! # Processing Pipeline
//!
//! 1. `RenderedCesium3dTileContent` + `RenderedCesium3dTileContentB3dmMarker` spawned
//! 2. `construct_model_by_cesium3dtiles_layer` extracts GLB and batch table
//! 3. Spawns entity with `ModelGeometry`, `ModelBin`, `FeatureBatchId`, etc.
//! 4. `navara_feature::model::system::transfer_mesh` creates `RenderableFeature`
//! 5. `remove_invisible_rendered_tiles` cleans up when tile goes out of view
//!
//! # Batch Table Integration
//!
//! B3DM tiles support per-feature properties via batch tables. Each feature
//! gets a global batch ID that can be used for:
//! - Per-feature styling
//! - Click/hover identification
//! - Property queries

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
    batch::{
        BatchProperty, BatchTable, BatchTableValue, FeatureBatchId, FeatureBatchIdMap,
        GlobalBatchIds,
    },
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

fn generate_global_batch_ids(
    batch_table_res: &mut BatchTable,
    batch_length: usize,
    global_batch_ids: &mut Vec<u32>,
    layer_id: &str,
) {
    for _i in 0..batch_length {
        let g_id = batch_table_res
            .add(Some(BatchTableValue {
                properties: None,
                layer_id: Some(layer_id.to_owned()),
            }))
            .unwrap_or(0);
        global_batch_ids.push(g_id);
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
        appearance.should_rotate_in_default = Some(false);

        let (center, glb_bin_handle, batch_table, batch_length) =
            match get_geometry_info_from_b3dm(&mut buf, &req.handle) {
                Some(r) => r,
                None => continue,
            };

        let mut global_batch_ids = Vec::with_capacity(batch_length);
        generate_global_batch_ids(
            &mut batch_table_res,
            batch_length,
            &mut global_batch_ids,
            &layer.layer_id,
        );

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

            if let Ok((_maker, mut feature)) = rendered_features.get_mut(*e) {
                if let RenderableFeature::Model {
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
        }

        for e in &b3dm_layers {
            commands.entity(e).despawn();
        }
        layer_store.remove(&d.0);
        commands.entity(e).despawn();
    }
}

/// Constructs model entities from B3DM tile data.
///
/// Triggered when a `RenderedCesium3dTileContent` with `RenderedCesium3dTileContentB3dmMarker`
/// is added. This system:
///
/// 1. Extracts GLB data from the B3DM container
/// 2. Reads CESIUM_RTC center coordinates
/// 3. Parses batch table for per-feature properties
/// 4. Generates global batch IDs for each feature
/// 5. Spawns a model entity with all required components
///
/// # Spawned Components
///
/// - `LayerId` - Links to parent layer
/// - `FeatureId` - Unique feature identifier
/// - `FeatureBatchId` - Batch table reference
/// - `GlobalBatchIds` - Per-feature batch IDs buffer
/// - `ModelGeometry` - Position and CRS info
/// - `ModelMaterial` - Appearance settings
/// - `ModelBin` - Handle to GLB binary data
/// - `Transform` - Rotation adjustment (Y-up to Z-up)
#[allow(clippy::too_many_arguments)]
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
        appearance.should_rotate_in_default = Some(false);
        appearance.clamp_to_ground = Some(false);

        let (center, glb_bin_handle, batch_table, batch_length) =
            match get_geometry_info_from_b3dm(&mut buf, &req.handle) {
                Some(r) => r,
                None => continue,
            };

        let mut global_batch_ids = Vec::with_capacity(batch_length);
        generate_global_batch_ids(
            &mut batch_table_res,
            batch_length,
            &mut global_batch_ids,
            &layer.layer_id,
        );

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

        let entity = commands.spawn((
            LayerId(layer.layer_id.to_owned()),
            FeatureId::default(),
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
        Vec3::new(center[0], center[1], center[2]),
        glb_bin_handle,
        b3dm.batch_table,
        batch_length,
    ))
}

/// Cleans up B3DM tiles that are no longer visible.
///
/// Unlike GLB tiles, B3DM tiles are completely removed when invisible
/// rather than just hidden. This is because B3DM tiles with batch tables
/// consume more memory, so the trade-off favors memory savings over
/// reconstruction cost.
///
/// # Cleanup Actions
///
/// 1. Marks feature entity with `Deleted`
/// 2. Marks renderable feature entity with `Deleted`
/// 3. Removes data requester buffer
/// 4. Marks data requester entity with `Deleted`
/// 5. Despawns the rendered tile entity
///
/// # Memory Cleanup Chain
///
/// The `Deleted` markers trigger `remove_batched_feature` in `navara_feature`
/// which cleans up:
/// - Batch table entries
/// - Global batch ID buffers
/// - Model binary data
// TODO: Preserve the constructed mesh if it is being touched like `glb::system::remove_invisible_rendered_tiles`,
//       but it wastes a lot of memory.
#[allow(clippy::type_complexity, clippy::too_many_arguments)]
pub fn remove_invisible_rendered_tiles(
    mut commands: Commands,
    mut buf: ResMut<BufferStore>,
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
        &FeatureId,
        (
            With<LayerId>,
            With<ModelGeometry>,
            With<ModelMaterial>,
            With<Transform>,
        ),
    >,
) {
    for (entity, tile, _) in &rendered_tiles {
        if tile.is_visible {
            continue;
        }

        if let Some(feature_id) = tile.feature_id {
            commands.entity(feature_id).insert(Deleted);
            if let Ok(rendered_feature_id) = features.get(feature_id) {
                if let Some(rendered_feature_id) = rendered_feature_id.0 {
                    commands.entity(rendered_feature_id).insert(Deleted);
                }
            }
        }

        // Remove data requester
        if let Ok(requester) = requesters.get(tile.data_requester_id) {
            buf.remove(&requester.handle);
            commands.entity(tile.data_requester_id).insert(Deleted);
        }

        commands.entity(entity).despawn();
    }
}
