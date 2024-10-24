use bevy_ecs::{
    entity::Entity,
    query::{Added, Changed, With},
    system::{Commands, Query, ResMut},
};
use bevy_log::error;
use navara_buffer_store::{BufferStore, Handle};
use navara_core::CRS;
use navara_data_requester::{DataRequester, DataRequesterExtension, DataRequesterStatus};
use navara_feature::{
    id::FeatureId,
    model::{ModelBin, ModelGeometry, ModelMarker},
    render::RenderableFeature,
};
use navara_layer::{B3dmLayer, Cesium3dTilesLayer, LayerId};
use navara_material::{Appearance, ModelMaterial};
use navara_math::{Quat, Transform, Vec3, PI_OVER_TWO};
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
pub fn construct_model_by_b3dm_layer(
    mut commands: Commands,
    mut buf: ResMut<BufferStore>,
    requesters: Query<(&B3dmLayerDataRequesterMarker, &DataRequester), Changed<DataRequester>>,
    b3dm_layers: Query<(Entity, &B3dmLayer)>,
) {
    for (marker, req) in &requesters {
        // TODO: Handle fail
        if !matches!(req.status, DataRequesterStatus::Success) {
            continue;
        }
        let (_, layer) = match b3dm_layers.get(marker.0) {
            Ok(l) => l,
            Err(_) => unreachable!(),
        };
        let mut appearance = match &layer.appearances[0] {
            Appearance::Model(m) => m.clone(),
            _ => unimplemented!(),
        };
        appearance.should_rotate_in_default = false;

        let (center, glb_bin_handle) = match get_geometry_info_from_b3dm(&mut buf, &req.handle) {
            Some(r) => r,
            None => continue,
        };

        commands.spawn((
            LayerId(layer.layer_id.to_owned()),
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

pub fn construct_model_by_cesium3dtiles_layer(
    mut commands: Commands,
    mut buf: ResMut<BufferStore>,
    requesters: Query<(
        &Cesium3dTileContentDataRequesterMarker,
        &B3dmDataRequesterMarker,
        &DataRequester,
    )>,
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
            Err(_) => unreachable!(),
        };
        let mut appearance = match &layer.appearances[0] {
            Appearance::Model(m) => m.clone(),
            _ => unimplemented!(),
        };
        appearance.should_rotate_in_default = false;

        let (center, glb_bin_handle) = match get_geometry_info_from_b3dm(&mut buf, &req.handle) {
            Some(r) => r,
            None => continue,
        };

        let entity = commands.spawn((
            LayerId(layer.layer_id.to_owned()),
            FeatureId::default(),
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

fn get_geometry_info_from_b3dm(buf: &mut BufferStore, handle: &Handle) -> Option<(Vec3, Handle)> {
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

    Some((
        Vec3::new(center[0] as f32, center[1] as f32, center[2] as f32),
        glb_bin_handle,
    ))
}

#[allow(clippy::type_complexity)]
pub fn remove_invisible_rendered_tiles(
    mut commands: Commands,
    mut buf: ResMut<BufferStore>,
    requesters: Query<
        &DataRequester,
        (
            With<Cesium3dTileContentDataRequesterMarker>,
            With<B3dmDataRequesterMarker>,
        ),
    >,
    rendered_tiles: Query<
        (Entity, &RenderedCesium3dTileContent, &TileOrderByDistance),
        With<RenderedCesium3dTileContentB3dmMarker>,
    >,
    features: Query<
        (&FeatureId, &ModelBin),
        (
            With<LayerId>,
            With<ModelGeometry>,
            With<ModelMaterial>,
            With<Transform>,
        ),
    >,
) {
    for (entity, tile, _) in rendered_tiles.iter().sort::<&TileOrderByDistance>() {
        if tile.is_visible {
            continue;
        }

        // Remove data requester
        if let Ok(requester) = requesters.get(tile.data_requester_id) {
            buf.remove(&requester.handle);
            commands.entity(tile.data_requester_id).remove::<(
                Cesium3dTileContentDataRequesterMarker,
                B3dmDataRequesterMarker,
                DataRequester,
            )>();
        }

        if let Some(feature_id) = tile.feature_id {
            // Remove feature
            if let Ok((rendered_feature_id, model_bin)) = features.get(feature_id) {
                buf.remove(&model_bin.0);
                if let Some(rendered_feature_id) = rendered_feature_id.0 {
                    commands
                        .entity(rendered_feature_id)
                        .remove::<(ModelMarker, RenderableFeature)>();
                }
            }
            commands.entity(feature_id).remove::<(
                LayerId,
                FeatureId,
                ModelGeometry,
                ModelMaterial,
                ModelBin,
                Transform,
            )>();
        }

        commands.entity(entity).remove::<(
            RenderedCesium3dTileContentB3dmMarker,
            RenderedCesium3dTileContent,
        )>();
    }
}
