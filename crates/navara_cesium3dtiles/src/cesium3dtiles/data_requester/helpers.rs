use bevy_ecs::{component::Component, entity::Entity, system::Commands};
use bevy_log::error;
use navara_buffer_store::BufferStore;
use navara_component::Priority;
use navara_data_requester::{DataRequester, DataRequesterExtension};
use url::Url;

use crate::{
    b3dm::B3dmDataRequesterMarker,
    cesium3dtiles::{types::Cesium3dTileContentRequesterQuery, url::uri_inherit_query_params},
    glb::GlbDataRequesterMarker,
    Cesium3dTileContent, TileOrderByDistance,
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

    let (tile_url, extension) = match tile.make_content_url(base_url) {
        Ok(Some((url, extension))) => match Url::parse(&url) {
            Ok(u) => (uri_inherit_query_params(u, base_url), extension),
            Err(e) => {
                error!("Failed to parse URL: {}", e);
                return false;
            }
        },
        Ok(None) => {
            error!("Tile content URL is None for tile: {:?}", tile);
            return false;
        }
        Err(e) => {
            error!("Failed to make content URL: {}", e);
            return false;
        }
    };

    let id = match extension {
        DataRequesterExtension::B3dm => commands
            .spawn((
                Cesium3dTileContentDataRequesterMarker,
                B3dmDataRequesterMarker,
                priority,
                TileOrderByDistance {
                    distance_from_camera: tile.state.distance_from_camera,
                    sse: tile.state.sse,
                },
                DataRequester::from_store(tile_url.to_string(), buf, extension),
            ))
            .id(),
        DataRequesterExtension::Glb => commands
            .spawn((
                Cesium3dTileContentDataRequesterMarker,
                GlbDataRequesterMarker,
                priority,
                TileOrderByDistance {
                    distance_from_camera: tile.state.distance_from_camera,
                    sse: tile.state.sse,
                },
                DataRequester::from_store(tile_url.to_string(), buf, extension),
            ))
            .id(),
        _ => {
            return false;
        }
    };

    tile.data_requester_id = Some(id);
    true
}
