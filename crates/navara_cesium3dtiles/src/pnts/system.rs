use bevy_ecs::{
    entity::Entity,
    query::{Added, Changed, With, Without},
    system::{Commands, Query, Res, ResMut},
};

use navara_buffer_store::{BufferStore, Handle};
use navara_component::{Deleted, Priority};
use navara_core::CRS;
use navara_data_requester::{DataRequester, DataRequesterExtension, DataRequesterStatus};
use navara_feature_component::{
    // batch::{
    //     BatchProperty, BatchTable, BatchTableValue, FeatureBatchId, FeatureBatchIdMap,
    //     GlobalBatchIdAndSelections, IdPropertySelections, IdPropertyTable,
    // },
    // id::FeatureId,
    model::{ModelBin, ModelGeometry, ModelMarker},
    render::RenderableFeature,
};
use navara_layer::{
    PntsLayer, Cesium3dTilesLayer, DeletePntsLayerMarker, LayerId, LayerStore,
    UpdatePntsLayerMarker,
};
use navara_material::{Appearance, ModelMaterial};
use navara_math::{Quat, Transform, Vec3, PI_OVER_TWO};

use navara_parser::pnts::*;

use crate::{
    Cesium3dTileContentDataRequesterMarker, RenderedCesium3dTileContent, TileOrderByDistance,
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
    // mut batch_table_res: ResMut<BatchTable>,
    // mut id_prop_table_res: ResMut<IdPropertyTable>,
    // id_prop_sel_res: Res<IdPropertySelections>,
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

        let (positions_len, positions_center, positions_handle) =
            match get_geometry_info_from_pnts(&mut buf, &req.handle) {
                Some(r) => r,
                None => continue,
            };

        // TODO: insert position_len into the entity
        commands.spawn((
            LayerId(layer.layer_id.to_owned()),
            ModelGeometry {
                coords: positions_center,
                crs: CRS::Geocentric,
            },
            appearance,
            ModelBin(positions_handle),
            Transform::from_rotation(Quat::from_rotation_x(PI_OVER_TWO)),
        ));

        buf.remove(&req.handle);
    }
}

fn get_geometry_info_from_pnts( buf: &mut BufferStore, handle: &Handle) -> Option<(usize, Vec3, Handle)> {
    let pnts_bin = buf.get_u8(handle)?;
    let mut pnts = Pnts::from_data(pnts_bin).unwrap();

    // TODO: make util functions at navara_pnts instead of these...
    let feature_table_json: serde_json::Value = parse_json_to_struct(&pnts.feature_table.json).unwrap();

    const N_POSITION_COMPONENTS: usize = 3;
    const N_POSITION_COMPONENTS_BYTE_SIZE: usize = 4;

    // TODO: handle errors more gracefully
    let positions_len = feature_table_json["POINTS_LENGTH"].as_u64()? as usize;
    let positions_offset = feature_table_json["POSITION"]["byteoffset"].as_u64()? as usize;
    let positions_byte_size = positions_len * N_POSITION_COMPONENTS * N_POSITION_COMPONENTS_BYTE_SIZE;

    // extract the position data from featuretable's binary blob
    let mut position_bin_data = pnts.feature_table.binary.split_off(positions_offset);
    position_bin_data = position_bin_data.split_off(positions_byte_size);

    let position_bin_handle = buf.new_u8(position_bin_data);

    // NOTE: buffer is removed here to prevent duplicating data.
    buf.remove(handle);

    let positions_center: Vec<f32> = match feature_table_json["RTC_CENTER"].as_array() {
        Some(arr) => arr.iter().map(|e| e.as_f64().unwrap() as f32).collect(),
        None => vec![0.0, 0.0, 0.0],
    };

    Some((
        positions_len,
        Vec3::new(positions_center[0], positions_center[1], positions_center[2]),
        position_bin_handle
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
    mut rendered_features: Query<(&ModelMarker, &mut RenderableFeature)>,
) {
    for (e, d) in &deleted {
        let entities = match layer_store.get(&d.0.clone()) {
            Some(e) => e,
            None => continue,
        };

        for e in entities {

            commands.entity(*e).despawn();
        }

        for e in &pnts_layers {
            commands.entity(e).despawn();
        }
        layer_store.remove(&d.0);
        commands.entity(e).despawn();
    }
}



#[allow(clippy::too_many_arguments)]
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
        &mut RenderedCesium3dTileContent,
        (
            With<RenderedCesium3dTileContentPntsMarker>,
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

        let (postions_len, postions_center, postions_handle) =
            match get_geometry_info_from_pnts(&mut buf, &req.handle) {
                Some(r) => r,
                None => continue,
            };

        let entity = commands.spawn((
            LayerId(layer.layer_id.to_owned()),
            ModelGeometry {
                coords: postions_center,
                crs: CRS::Geocentric,
            },
            appearance,
            ModelBin(postions_handle),
            Transform::from_rotation(Quat::from_rotation_x(PI_OVER_TWO)),
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
    // features: Query<
    //     &FeatureId,
    //     (
    //         With<LayerId>,
    //         With<ModelGeometry>,
    //         With<ModelMaterial>,
    //         With<Transform>,
    //     ),
    // >,
) {
    for (entity, tile, _) in &rendered_tiles {
        if tile.is_visible {
            continue;
        }

        // if let Some(feature_id) = tile.feature_id {
        //     // Remove feature
        //     if let Ok(rendered_feature_id) = features.get(feature_id) {
        //         if let Some(rendered_feature_id) = rendered_feature_id.0 {
        //             commands.entity(feature_id).insert(Deleted);
        //             commands.entity(rendered_feature_id).insert(Deleted);
        //         } else {
        //             continue;
        //         }
        //     } else {
        //         continue;
        //     }
        // } else {
        //     continue;
        // }

        // Remove data requester
        if let Ok(requester) = requesters.get(tile.data_requester_id) {
            buf.remove(&requester.handle);
            commands.entity(tile.data_requester_id).insert(Deleted);
        }

        commands.entity(entity).despawn();
    }
}
