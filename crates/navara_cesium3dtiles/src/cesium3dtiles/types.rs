use bevy_ecs::{
    query::{Or, With},
    system::Query,
};
use navara_data_requester::DataRequester;

use crate::b3dm::B3dmDataRequesterMarker;

use super::Cesium3dTileContentDataRequesterMarker;

pub type Cesium3dTileContentRequesterQuery<'a, 'world, 'state> = Query<
    'world,
    'state,
    (
        &'a Cesium3dTileContentDataRequesterMarker,
        &'a DataRequester,
    ),
    Or<(
        With<B3dmDataRequesterMarker>,
        // With<GlbDataRequesterMarker>
    )>,
>;
