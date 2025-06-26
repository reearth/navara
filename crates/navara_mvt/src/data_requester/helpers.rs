use bevy_ecs::{entity::Entity, system::Commands};
use navara_buffer_store::BufferStore;
use navara_component::{OrderByDistance, Priority};
use navara_core::{is_tile_url, tile_url};
use navara_data_requester::{DataRequester, DataRequesterExtension};
use navara_layer::MvtLayer;
use navara_tile_component::{TileHandle, VectorTile};

use super::{MvtDataRequesterMarker, MvtDataRequesterQuery};

pub(crate) fn request_mvt_data(
    commands: &mut Commands,
    tile: &mut VectorTile,
    buf: &mut BufferStore,
    layer: &MvtLayer,
    handle: TileHandle,
    data_requesters: &MvtDataRequesterQuery,
    priority: Priority,
) -> Option<Entity> {
    let data_requester_entity_id = tile.data_requester_entity_id;
    if matches!(data_requester_entity_id, Some(e) if data_requesters.contains(e)) {
        return None;
    }
    let url = layer.data.as_ref().unwrap().url.clone();
    if !is_tile_url(&url) {
        panic!("Unexpected URL type {}", url);
    }

    let e = commands
        .spawn((
            MvtDataRequesterMarker(handle),
            DataRequester::from_store(
                tile_url(&layer.data.as_ref().unwrap().url, &tile.coords, false),
                buf,
                DataRequesterExtension::Mvt,
            ),
            OrderByDistance {
                sse: tile.sse,
                distance: tile.distance_from_camera,
            },
            priority,
        ))
        .id();
    tile.data_requester_entity_id = Some(e);

    Some(e)
}
