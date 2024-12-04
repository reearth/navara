use bevy_ecs::{
    entity::Entity,
    query::{Added, With, Without},
    system::{Commands, Query, ResMut},
};
use navara_buffer_store::BufferStore;
use navara_component::{Deleted, Ignored, OrderByDistance, Priority, Requested};
use navara_data_requester::DataRequester;
use navara_tile_component::{RasterTileQuadtree, TerrainDataRequesterMarker};

const MAX_PENDINGS: u32 = 20;

#[allow(clippy::type_complexity)]
pub(crate) fn filter_requestable_data_requester(
    mut commands: Commands,
    mut qt: ResMut<RasterTileQuadtree>,
    mut buf: ResMut<BufferStore>,
    data_requesters: Query<
        (
            Entity,
            &TerrainDataRequesterMarker,
            &DataRequester,
            &OrderByDistance,
            &Priority,
        ),
        (Added<TerrainDataRequesterMarker>, Without<Deleted>),
    >,
    requested_data_requesters: Query<
        Entity,
        (
            With<TerrainDataRequesterMarker>,
            With<DataRequester>,
            With<Requested>,
            Without<Deleted>,
        ),
    >,
) {
    let pendings = requested_data_requesters.iter().count();
    let num_skip = (MAX_PENDINGS as i32 - pendings as i32).max(0);

    // Limit the number of requests in this frame
    for (e, marker, _, _, _) in data_requesters
        .iter()
        .sort::<(&Priority, &OrderByDistance)>()
        .skip(num_skip as usize)
    {
        let handle = marker.0;
        let tile = qt.qt.get_mut(handle);
        if let Some(tile) = tile {
            if let Some(terrain_data) = tile.terrain_data.as_mut() {
                terrain_data.set_data_requester_entity_id(None);
                terrain_data.destroy(&mut buf);
                tile.terrain_data = None;
            };
            commands.entity(e).insert((Deleted, Ignored));
        }
    }
}
