use bevy_ecs::{
    entity::Entity,
    query::{Added, Or, With, Without},
    system::{Commands, Query},
};
use navara_component::{Deleted, Ignored, Requested};
use navara_data_requester::DataRequester;

use crate::{
    b3dm::B3dmDataRequesterMarker, cesium3dtiles::order::TileOrderByDistance,
    Cesium3dTileContentDataRequesterMarker,
};

const MAX_PENDINGS: u32 = 20;

#[allow(clippy::type_complexity)]
pub fn filter_requestable_data_requester(
    mut commands: Commands,
    data_requesters: Query<
        (Entity, &DataRequester, &TileOrderByDistance),
        (
            With<DataRequester>,
            With<Cesium3dTileContentDataRequesterMarker>,
            Or<(
                With<B3dmDataRequesterMarker>,
                // With<GlbDataRequesterMarker>
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
                // With<GlbDataRequesterMarker>
            )>,
            Without<Deleted>,
        ),
    >,
) {
    let pendings = requested_data_requesters.iter().count();
    let num_skip = (MAX_PENDINGS as i32 - pendings as i32).max(0);

    // Limit the number of requests in this frame
    for (e, _, _) in data_requesters
        .iter()
        .sort::<&TileOrderByDistance>()
        .skip(num_skip as usize)
    {
        commands.entity(e).insert((Deleted, Ignored));
    }
}
