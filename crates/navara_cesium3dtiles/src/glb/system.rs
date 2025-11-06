use bevy_ecs::{
    entity::Entity,
    query::{Added, With, Without},
    system::{Commands, Query, ResMut},
};
use navara_buffer_store::{BufferStore, Handle};
use navara_component::Deleted;
use navara_core::CRS;
use navara_data_requester::{DataRequester, DataRequesterStatus};
use navara_feature_component::{
    batch::{FeatureBatchId, GlobalBatchIds},
    id::FeatureId,
    model::{ModelBin, ModelGeometry},
};
use navara_layer::{Cesium3dTilesLayer, LayerId};
use navara_material::{Appearance, ModelMaterial};
use navara_math::{Quat, Transform, Vec3, PI_OVER_TWO};

use crate::{
    Cesium3dTileContentDataRequesterMarker, RenderedCesium3dTileContent, TileOrderByDistance,
};

use super::{requester::GlbDataRequesterMarker, RenderedCesium3dTileContentGlbMarker};

#[allow(clippy::too_many_arguments)]
pub fn construct_model_by_cesium3dtiles_layer(
    mut commands: Commands,
    // mut buf: ResMut<BufferStore>,
    requesters: Query<
        (
            &Cesium3dTileContentDataRequesterMarker,
            &GlbDataRequesterMarker,
            &DataRequester,
        ),
        Without<Deleted>,
    >,
    mut rendered_tiles: Query<
        &mut RenderedCesium3dTileContent,
        (
            With<RenderedCesium3dTileContentGlbMarker>,
            Added<RenderedCesium3dTileContent>,
        ),
    >,
    layers: Query<(Entity, &Cesium3dTilesLayer)>,
) {
    // info!("requesters: {:?}", requesters);
    // info!("rendered tiles: {:?}", rendered_tiles);
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

        let entity = commands.spawn((
            LayerId(layer.layer_id.to_owned()),
            FeatureId::default(),
            FeatureBatchId(0),
            GlobalBatchIds {
                handle: Handle::default(),
                batch_length: 0,
            },
            ModelGeometry {
                coords: Vec3::ZERO,
                crs: CRS::Geocentric,
            },
            appearance,
            ModelBin(req.handle),
            // TODO: Check asset property in tileset.json.
            // TODO: Clamp the height to terrain height.
            Transform::from_rotation(Quat::from_rotation_x(PI_OVER_TWO)),
        ));
        tile.feature_id = Some(entity.id());

        // buf.remove(&req.handle);
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
            With<GlbDataRequesterMarker>,
            Without<Deleted>,
        ),
    >,
    rendered_tiles: Query<
        (Entity, &RenderedCesium3dTileContent, &TileOrderByDistance),
        With<RenderedCesium3dTileContentGlbMarker>,
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
