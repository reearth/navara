use bevy_ecs::{component::Component, entity::Entity, system::Commands};
use bevy_log::error;
use navara_buffer_store::BufferStore;
use navara_component::Priority;
use navara_data_requester::{DataRequester, DataRequesterExtension};
use url::Url;

use crate::{
    b3dm::B3dmDataRequesterMarker, cesium3dtiles::types::Cesium3dTileContentRequesterQuery,
    pnts::PntsDataRequesterMarker, Cesium3dTileContent, TileOrderByDistance,
};

#[derive(Component)]
pub struct Cesium3dTilesMetadataDataRequesterMarker(pub Entity);

#[derive(Component)]
pub struct Cesium3dTileContentDataRequesterMarker;

// TODO: Request again if the request failed.
pub(crate) fn request_tile_content(
    commands: &mut Commands,
    buf: &mut BufferStore,
    base_url: &Url,
    tile: &mut Cesium3dTileContent,
    requesters: &Cesium3dTileContentRequesterQuery,
    priority: Priority,
) -> bool {
    let data_requester_entity_id = tile.data_requester_id;
    if let Some(id) = data_requester_entity_id {
        if requesters.contains(id) {
            return false;
        }
    }
    let (content_url, extension) = match tile.make_content_url(base_url) {
        Ok(url) => url,
        Err(e) => {
            error!("{}", e);
            return false;
        }
    };

    match extension {
        DataRequesterExtension::Pnts => {
            let id = commands
                .spawn((
                    Cesium3dTileContentDataRequesterMarker,
                    PntsDataRequesterMarker,
                    priority,
                    TileOrderByDistance {
                        distance_from_camera: tile.state.distance_from_camera,
                        sse: tile.state.sse,
                    },
                    DataRequester::from_store(content_url, buf, extension),
                ))
                .id();
            tile.data_requester_id = Some(id);
            true
        }
        DataRequesterExtension::B3dm => {
            let id = commands
                .spawn((
                    Cesium3dTileContentDataRequesterMarker,
                    B3dmDataRequesterMarker,
                    priority,
                    TileOrderByDistance {
                        distance_from_camera: tile.state.distance_from_camera,
                        sse: tile.state.sse,
                    },
                    DataRequester::from_store(content_url, buf, extension),
                ))
                .id();
            tile.data_requester_id = Some(id);
            true
        }
        _ => false,
    }
}
