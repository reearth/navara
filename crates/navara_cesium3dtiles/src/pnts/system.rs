use bevy_ecs::{
    entity::Entity,
    query::{Added, Changed, With, Without},
    system::{Commands, Query, Res, ResMut},
};

use navara_buffer_store::{BufferStore, Handle};
use navara_component::{Deleted, Priority};
use navara_core::{Aabb, CRS};
use navara_data_requester::{DataRequester, DataRequesterExtension, DataRequesterStatus};
use navara_feature_component::{
    batch::{FeatureBatchId, GlobalBatchIds},
    id::FeatureId,
    model::{ModelBin, ModelGeometry},
    render::RenderableFeature,
};
use navara_layer::{
    Cesium3dTilesLayer, DeletePntsLayerMarker, LayerId, LayerStore, PntsLayer,
    UpdatePntsLayerMarker,
};
use navara_material::{Appearance, ModelInternalMaterial, ModelMaterial};
use navara_math::{Transform, Vec3};

use navara_parser::pnts::*;

use crate::{
    Cesium3dTileContentDataRequesterMarker, RenderedCesium3dTileContent, TileOrderByDistance,
    TileTransform,
};

use super::{
    requester::{PntsDataRequesterMarker, PntsLayerDataRequesterMarker},
    RenderedCesium3dTileContentPntsMarker,
};

pub fn request_model_by_pnts_layer(
    mut commands: Commands,
    mut buf: ResMut<BufferStore>,
    pnts_layers: Query<(Entity, &PntsLayer), Added<PntsLayer>>,
) {
    for (e, layer) in &pnts_layers {
        commands.spawn((
            PntsLayerDataRequesterMarker(e),
            Priority::Medium,
            DataRequester::from_store(
                layer.data.as_ref().unwrap().url.clone(),
                &mut buf,
                DataRequesterExtension::Pnts,
            ),
        ));
    }
}

#[allow(clippy::type_complexity)]
pub fn construct_model_by_pnts_layer(
    mut commands: Commands,
    mut buf: ResMut<BufferStore>,
    requesters: Query<
        (Entity, &PntsLayerDataRequesterMarker, &DataRequester),
        (Changed<DataRequester>, Without<Deleted>),
    >,
    pnts_layers: Query<&PntsLayer>,
) {
    for (e, marker, req) in &requesters {
        if !matches!(req.status, DataRequesterStatus::Pending) {
            commands.entity(e).despawn();
        }

        // TODO: Handle fail
        if !matches!(req.status, DataRequesterStatus::Success) {
            continue;
        }
        let layer = match pnts_layers.get(marker.0) {
            Ok(l) => l,
            Err(_) => unreachable!(),
        };
        let mut appearance = match &layer.appearances[0] {
            Appearance::Model(m) => m.clone(),
            _ => unimplemented!(),
        };
        appearance.should_rotate_in_default = false;
        appearance.clamp_to_ground = false;

        let (draco_compressed, positions_center, positions_handle) =
            match get_geometry_info_from_pnts(&mut buf, &req.handle) {
                Some(r) => r,
                None => continue,
            };

        appearance.internal = Some(ModelInternalMaterial {
            draco_compressed,
            point_cloud: true,
        });

        commands.spawn((
            LayerId(layer.layer_id.to_owned()),
            FeatureId::default(),
            FeatureBatchId(0), // Dummy value,
            GlobalBatchIds {
                // Dummy value
                handle: Handle::default(),
                batch_length: 0,
            },
            ModelGeometry {
                coords: positions_center,
                crs: CRS::Geocentric,
            },
            appearance,
            ModelBin(positions_handle),
            Transform::IDENTITY,
        ));

        buf.remove(&req.handle);
    }
}

fn get_geometry_info_from_pnts(
    buf: &mut BufferStore,
    handle: &Handle,
) -> Option<(bool, Vec3, Handle)> {
    let pnts_bin = buf.get_u8(handle)?;
    let mut pnts = Pnts::from_data(pnts_bin).ok()?;

    let feature_table_json: serde_json::Value =
        parse_json_to_struct(&pnts.feature_table.json).ok()?;

    // Find out if the pnts uses Draco compression
    let draco_compression_meta = feature_table_json["extensions"]
        .as_object()
        .and_then(|ext| {
            if let Some(draco_meta) = ext["3DTILES_draco_point_compression"].as_object() {
                let properties = draco_meta["properties"].as_object().unwrap();
                let byte_offset = draco_meta["byteOffset"].as_u64().unwrap();
                let byte_length = draco_meta["byteLength"].as_u64().unwrap();
                Some((properties, byte_offset, byte_length))
            } else {
                None
            }
        });

    let mut position_bin_data: Vec<u8>;
    let mut draco_compressed = false;
    if let Some((_, byte_offset, byte_length)) = draco_compression_meta {
        // Draco compression
        // extract the draco compressed data from featuretable's binary blob
        position_bin_data = pnts.feature_table.binary.split_off(byte_offset as usize);
        position_bin_data.truncate(byte_length as usize);
        draco_compressed = true;
    } else {
        // No Draco compression
        const N_POSITION_COMPONENTS: usize = 3;
        const N_POSITION_COMPONENTS_BYTE_SIZE: usize = 4;

        let positions_len = feature_table_json["POINTS_LENGTH"].as_u64()? as usize;
        let positions_offset = feature_table_json["POSITION"]["byteOffset"].as_u64()? as usize;
        let positions_byte_size =
            positions_len * N_POSITION_COMPONENTS * N_POSITION_COMPONENTS_BYTE_SIZE;

        // TODO: support color, normal, etc for non-draco compressed data.
        // extract the position data from featuretable's binary blob
        position_bin_data = pnts.feature_table.binary.split_off(positions_offset);
        position_bin_data.truncate(positions_byte_size);
    }

    let position_bin_handle = buf.new_u8(position_bin_data);

    // NOTE: buffer is removed here to prevent duplicating data.
    buf.remove(handle);

    let positions_center: Vec<f64> = match feature_table_json["RTC_CENTER"].as_array() {
        Some(arr) => arr.iter().map(|e| e.as_f64().unwrap()).collect(),
        None => vec![0.0, 0.0, 0.0],
    };

    Some((
        draco_compressed,
        Vec3::new(
            positions_center[0],
            positions_center[1],
            positions_center[2],
        ),
        position_bin_handle,
    ))
}

pub fn update_model_by_pnts_layer(
    mut commands: Commands,
    layer_store: Res<LayerStore>,
    updated: Query<(Entity, &UpdatePntsLayerMarker)>,
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
pub fn delete_model_by_pnts_layer(
    mut commands: Commands,
    mut buf: ResMut<BufferStore>,
    mut layer_store: ResMut<LayerStore>,
    deleted: Query<(Entity, &DeletePntsLayerMarker)>,
    pnts_layers: Query<Entity, With<PntsLayer>>,
    features: Query<
        &ModelBin,
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
            if let Ok(f) = features.get(*e) {
                buf.remove(&f.0);
            };
            commands.entity(*e).despawn();
        }

        for e in &pnts_layers {
            commands.entity(e).despawn();
        }
        layer_store.remove(&d.0);
        commands.entity(e).despawn();
    }
}

#[allow(clippy::type_complexity, clippy::too_many_arguments)]
pub fn construct_model_by_cesium3dtiles_layer(
    mut commands: Commands,
    mut buf: ResMut<BufferStore>,
    requesters: Query<
        (
            &Cesium3dTileContentDataRequesterMarker,
            &PntsDataRequesterMarker,
            &DataRequester,
        ),
        Without<Deleted>,
    >,
    mut rendered_tiles: Query<
        (&mut RenderedCesium3dTileContent, &TileTransform, &Aabb),
        (
            With<RenderedCesium3dTileContentPntsMarker>,
            Added<RenderedCesium3dTileContent>,
        ),
    >,
    layers: Query<(Entity, &Cesium3dTilesLayer)>,
) {
    for (mut tile, transform, aabb) in &mut rendered_tiles {
        let (_, _, req) = match requesters.get(tile.data_requester_id) {
            Ok(v) => v,
            Err(_) => {
                continue;
            }
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

        let (draco_compressed, postions_center, postions_handle) =
            match get_geometry_info_from_pnts(&mut buf, &req.handle) {
                Some(r) => r,
                None => continue,
            };

        appearance.internal = Some(ModelInternalMaterial {
            draco_compressed,
            point_cloud: true,
        });

        let entity = commands.spawn((
            LayerId(layer.layer_id.to_owned()),
            FeatureId::default(),
            FeatureBatchId(0), // Dummy value,
            GlobalBatchIds {
                // Dummy value
                handle: Handle::default(),
                batch_length: 0,
            },
            ModelGeometry {
                coords: postions_center,
                crs: CRS::Geocentric,
            },
            appearance,
            ModelBin(postions_handle),
            transform.transform,
            aabb.clone(),
        ));
        tile.feature_id = Some(entity.id());

        buf.remove(&req.handle);
    }
}

#[allow(clippy::type_complexity, clippy::too_many_arguments)]
pub fn remove_invisible_rendered_tiles(
    mut commands: Commands,
    mut buf: ResMut<BufferStore>,
    requesters: Query<
        &DataRequester,
        (
            With<Cesium3dTileContentDataRequesterMarker>,
            With<PntsDataRequesterMarker>,
            Without<Deleted>,
        ),
    >,
    rendered_tiles: Query<
        (Entity, &RenderedCesium3dTileContent, &TileOrderByDistance),
        With<RenderedCesium3dTileContentPntsMarker>,
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
            // Remove feature
            if let Ok(rendered_feature_id) = features.get(feature_id) {
                if let Some(rendered_feature_id) = rendered_feature_id.0 {
                    commands.entity(feature_id).insert(Deleted);
                    commands.entity(rendered_feature_id).insert(Deleted);
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
