use bevy_ecs::{
    query::{Added, Changed, Or, With, Without},
    system::Query,
};
use navara_component::Deleted;
use navara_data_requester::DataRequester;

use crate::{b3dm::B3dmDataRequesterMarker, pnts::PntsDataRequesterMarker, glb::GlbDataRequesterMarker};

use super::Cesium3dTileContentDataRequesterMarker;

pub type Cesium3dTileContentRequesterQuery<'a, 'world, 'state> = Query<
    'world,
    'state,
    (
        &'a Cesium3dTileContentDataRequesterMarker,
        &'a DataRequester,
    ),
    (
        Or<(
            With<B3dmDataRequesterMarker>,
            With<PntsDataRequesterMarker>,
            With<GlbDataRequesterMarker>,
            // With<GlbDataRequesterMarker>
        )>,
        Without<Deleted>,
    ),
>;

pub type ChangedCesium3dTileContentRequesterQuery<'a, 'world, 'state> = Query<
    'world,
    'state,
    (
        &'a Cesium3dTileContentDataRequesterMarker,
        &'a DataRequester,
    ),
    (
        Or<(
            With<B3dmDataRequesterMarker>,
            With<PntsDataRequesterMarker>,
            With<GlbDataRequesterMarker>,
            // With<GlbDataRequesterMarker>
        )>,
        Or<(Added<DataRequester>, Changed<DataRequester>)>,
        Without<Deleted>,
    ),
>;
