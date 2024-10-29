use bevy_ecs::{
    entity::Entity,
    query::Added,
    system::{Commands, Query, Res, ResMut},
};
use navara_data_requester::{DataRequester, DataRequesterManager};

use crate::tile::{render::TileOrderByDistance, TileQuadtree};

use super::TerrainDataRequesterMarker;

pub(crate) fn filter_requestable_data_requester(
    mut commands: Commands,
    data_requester_manager: Res<DataRequesterManager>,
    mut qt: ResMut<TileQuadtree>,
    data_requesters: Query<
        (
            Entity,
            &TerrainDataRequesterMarker,
            &DataRequester,
            &TileOrderByDistance,
        ),
        Added<TerrainDataRequesterMarker>,
    >,
) {
    let num_skip = data_requester_manager.count_remaining_pending();

    // Limit the number of requests in this frame
    for (e, marker, _, _) in data_requesters
        .iter()
        .sort::<&TileOrderByDistance>()
        .skip(num_skip as usize)
    {
        let handle = marker.0;
        let tile = qt.qt.get_mut(handle);
        if let Some(tile) = tile {
            tile.terrain_data
                .as_mut()
                .unwrap()
                .set_data_requester_entity_id(None);
            tile.terrain_data = None;
            commands.entity(e).remove::<(
                TerrainDataRequesterMarker,
                DataRequester,
                TileOrderByDistance,
            )>();
        }
    }
}
