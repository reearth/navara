use bevy_ecs::{
    entity::Entity,
    query::{Added, With, Without},
    system::{Commands, Query, ResMut},
};
use navara_buffer_store::BufferStore;
use navara_component::{Deleted, Ignored, OrderByDistance, Priority, Requested};
use navara_data_requester::{DataRequester, DataRequesterExtension};
use navara_layer::MvtLayer;
use navara_tile_component::VectorTileQuadtree;

use crate::layer::{resource::LayerResources, tile_cache_manager::TileCacheManager};

use super::{MvtDataRequesterMarker, SingleMvtDataRequesterMarker};

/// Handle only one MVT file for debug.
pub fn request_single_mvt(
    mut commands: Commands,
    mut buf: ResMut<BufferStore>,
    mvt_layers: Query<(Entity, &MvtLayer), Added<MvtLayer>>,
) {
    for (e, layer) in &mvt_layers {
        if layer.has_template_url() {
            continue;
        }

        commands.spawn((
            SingleMvtDataRequesterMarker(e),
            Priority::Medium,
            DataRequester::from_store(
                layer.data.as_ref().unwrap().url.clone(),
                &mut buf,
                DataRequesterExtension::Mvt,
            ),
        ));
    }
}

const MAX_PENDINGS: u32 = 10;

#[allow(clippy::type_complexity)]
pub(crate) fn filter_requestable_data_requester(
    mut commands: Commands,
    layers: Query<&LayerResources, With<MvtLayer>>,
    mut qts: Query<&mut VectorTileQuadtree>,
    mut tcs: Query<&mut TileCacheManager>,
    data_requesters: Query<
        (
            Entity,
            &MvtDataRequesterMarker,
            &DataRequester,
            &OrderByDistance,
            &Priority,
        ),
        (Added<MvtDataRequesterMarker>, Without<Deleted>),
    >,
    requested_data_requesters: Query<
        Entity,
        (
            With<MvtDataRequesterMarker>,
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
        for layer in &layers {
            let Ok(mut qt) = qts.get_mut(layer.quadtree) else {
                continue;
            };
            let Ok(mut tc) = tcs.get_mut(layer.tile_cache_manager) else {
                continue;
            };

            // Check if this layer has same data requester.
            if !tc
                .requested_tile_caches
                .get(&handle)
                .map_or(false, |te| te == &e)
            {
                continue;
            }
            tc.requested_tile_caches.remove(&handle);

            let Some(tile) = qt.qt.get_mut(handle) else {
                continue;
            };
            tile.data_requester_entity_id = None;
        }
        commands.entity(e).insert((Deleted, Ignored));
    }
}
