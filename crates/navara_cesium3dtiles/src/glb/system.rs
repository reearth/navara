use bevy_ecs::{
    entity::Entity,
    query::{Added, With, Without},
    system::{Commands, Query, ResMut},
};
use navara_buffer_store::BufferStore;
use navara_component::Deleted;
use navara_core::CRS;
use navara_data_requester::DataRequester;
use navara_feature_component::{batch::FeatureBatchId, id::FeatureId, model::ModelGeometry};
use navara_layer::{Cesium3dTilesLayer, LayerId};
use navara_material::Appearance;
use navara_math::{Quat, Transform, Vec3, PI_OVER_TWO};

use crate::{
    cesium3dtiles::data_requester::helpers::Cesium3dTileContentDataRequesterMarker,
    glb::RenderedCesium3dTileContentGlbMarker, RenderedCesium3dTileContent,
};

use super::requester::GlbDataRequesterMarker;

pub fn construct_model_by_cesium3dtiles_layer(
    mut commands: Commands,
    mut _buf: ResMut<BufferStore>,
    _requesters: Query<
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
    for mut tile in &mut rendered_tiles {
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
        appearance.url = tile.url.as_ref().unwrap().clone();

        let entity = commands.spawn((
            LayerId(layer.layer_id.to_owned()),
            FeatureId::default(),
            FeatureBatchId(0),
            ModelGeometry {
                coords: Vec3::ZERO,
                crs: CRS::Geocentric,
            },
            appearance,
            Transform::from_rotation(Quat::from_rotation_x(PI_OVER_TWO)),
        ));
        tile.feature_id = Some(entity.id());
    }
}
