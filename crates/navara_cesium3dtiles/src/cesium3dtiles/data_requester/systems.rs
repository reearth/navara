use bevy_ecs::{
    entity::Entity,
    query::{Added, Or, With, Without},
    system::{Commands, Query},
};
use navara_component::{Deleted, Ignored, Priority, Requested};
use navara_data_requester::DataRequester;

use crate::{
    Cesium3dTileContentDataRequesterMarker, Cesium3dTilesMetadataDataRequesterMarker,
    Cesium3dTilesTreeOrder, b3dm::B3dmDataRequesterMarker,
    cesium3dtiles::order::TileOrderByDistance, glb::GlbDataRequesterMarker,
    pnts::PntsDataRequesterMarker,
};

const MAX_PENDINGS: u32 = 10;

#[allow(clippy::type_complexity)]
pub fn filter_requestable_data_requester(
    mut commands: Commands,
    data_requesters: Query<
        (
            Entity,
            &DataRequester,
            &Priority,
            Option<&TileOrderByDistance>,
            Option<&Cesium3dTilesTreeOrder>,
        ),
        (
            With<DataRequester>,
            With<Cesium3dTileContentDataRequesterMarker>,
            Or<(
                With<B3dmDataRequesterMarker>,
                With<PntsDataRequesterMarker>,
                With<GlbDataRequesterMarker>,
                With<Cesium3dTilesMetadataDataRequesterMarker>,
            )>,
            Added<DataRequester>,
            Without<Deleted>,
        ),
    >,
    requested_data_requesters: Query<
        Entity,
        (
            With<DataRequester>,
            With<Requested>,
            With<Cesium3dTileContentDataRequesterMarker>,
            Or<(
                With<B3dmDataRequesterMarker>,
                With<PntsDataRequesterMarker>,
                With<GlbDataRequesterMarker>,
                With<Cesium3dTilesMetadataDataRequesterMarker>,
            )>,
            Without<Deleted>,
        ),
    >,
) {
    let pendings = requested_data_requesters.iter().count();
    let num_skip = (MAX_PENDINGS as i32 - pendings as i32).max(0);

    // Limit the number of requests in this frame
    for (e, _, _, _, _) in data_requesters
        .iter()
        .sort::<(
            &Priority,
            Option<&Cesium3dTilesTreeOrder>,
            Option<&TileOrderByDistance>,
        )>()
        .skip(num_skip as usize)
    {
        commands.entity(e).insert((Deleted, Ignored));
    }
}
