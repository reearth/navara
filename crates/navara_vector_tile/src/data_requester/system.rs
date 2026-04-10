use bevy_ecs::{
    entity::Entity,
    query::{Added, With, Without},
    system::{Commands, Query},
};
use navara_component::{Deleted, Ignored, OrderByDistance, Priority, Requested};
use navara_data_requester::DataRequester;
use navara_tile_component::VectorTileQuadtree;

use crate::{VectorTileSourceResources, layer::tile_cache_manager::TileCacheManager};

use super::VectorTileDataRequesterMarker;

const MAX_PENDINGS: u32 = 50;

#[allow(clippy::type_complexity)]
pub fn filter_requestable_data_requester(
    mut commands: Commands,
    layers: Query<&VectorTileSourceResources>,
    mut qts: Query<&mut VectorTileQuadtree>,
    mut tcs: Query<&mut TileCacheManager>,
    data_requesters: Query<
        (
            Entity,
            &VectorTileDataRequesterMarker,
            &DataRequester,
            &OrderByDistance,
            &Priority,
        ),
        (Added<VectorTileDataRequesterMarker>, Without<Deleted>),
    >,
    requested_data_requesters: Query<
        Entity,
        (
            With<VectorTileDataRequesterMarker>,
            With<DataRequester>,
            With<Requested>,
            Without<Deleted>,
        ),
    >,
) {
    let pendings = requested_data_requesters.iter().count();
    let num_skip = (MAX_PENDINGS as i32 - pendings as i32).max(0);

    for (e, marker, _, _, _) in data_requesters
        .iter()
        .sort::<(&Priority, &OrderByDistance)>()
        .skip(num_skip as usize)
    {
        let handle = marker.0;
        for layer in &layers {
            let Ok(mut qt) = qts.get_mut(layer.quadtree) else {
                continue;
            };
            let Ok(mut tc) = tcs.get_mut(layer.tile_cache_manager) else {
                continue;
            };

            if tc.requested_tile_caches.get(&handle) != Some(&e) {
                continue;
            }
            tc.requested_tile_caches.remove(&handle);

            let Some(tile) = qt.qt.get_mut(handle) else {
                continue;
            };
            tile.data_requester_entity_id = None;
        }
        commands.entity(e).try_insert((Deleted, Ignored));
    }
}
