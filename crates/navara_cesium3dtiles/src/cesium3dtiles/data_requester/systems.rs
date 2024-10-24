use bevy_ecs::{
    entity::Entity,
    query::{Added, Or, With},
    system::{Commands, Query, Res},
};
use navara_data_requester::{DataRequester, DataRequesterManager};

use crate::{
    b3dm::B3dmDataRequesterMarker, cesium3dtiles::order::TileOrderByDistance,
    Cesium3dTileContentDataRequesterMarker,
};

#[allow(clippy::type_complexity)]
pub fn filter_requestable_data_requester(
    mut commands: Commands,
    data_requester_manager: Res<DataRequesterManager>,
    data_requesters: Query<
        (Entity, &TileOrderByDistance),
        (
            With<DataRequester>,
            With<Cesium3dTileContentDataRequesterMarker>,
            Or<(
                With<B3dmDataRequesterMarker>,
                // With<GlbDataRequesterMarker>
            )>,
            Added<DataRequester>,
        ),
    >,
) {
    let num_skip = data_requester_manager.count_remaining_pending();

    // Limit the number of requests in this frame
    for (e, _) in data_requesters
        .iter()
        .sort::<&TileOrderByDistance>()
        .skip(num_skip as usize)
    {
        commands.entity(e).remove::<(
            B3dmDataRequesterMarker,
            Cesium3dTileContentDataRequesterMarker,
            DataRequester,
            TileOrderByDistance,
        )>();
    }
}
