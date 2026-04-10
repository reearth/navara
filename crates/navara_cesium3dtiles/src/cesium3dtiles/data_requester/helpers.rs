use bevy_ecs::{component::Component, entity::Entity, system::Commands};
use bevy_log::error;
use navara_buffer_store::BufferStore;
use navara_component::Priority;
use navara_data_requester::{DataRequester, DataRequesterExtension};
use url::Url;

use crate::{
    Cesium3dTileContent, Cesium3dTilesTreeOrder, TileOrderByDistance,
    b3dm::B3dmDataRequesterMarker, cesium3dtiles::types::Cesium3dTileContentRequesterQuery,
    glb::GlbDataRequesterMarker, gltf_features::GltfFeaturesDataRequesterMarker,
    pnts::PntsDataRequesterMarker,
};

#[derive(Component)]
pub struct Cesium3dTilesMetadataDataRequesterMarker(pub Entity);

#[derive(Component)]
pub struct Cesium3dTileContentDataRequesterMarker;

// TODO: Request again if the request failed.
#[allow(clippy::too_many_arguments)]
pub(crate) fn request_tile_content(
    commands: &mut Commands,
    buf: &mut BufferStore,
    base_url: &Url,
    tile: &mut Cesium3dTileContent,
    requesters: &Cesium3dTileContentRequesterQuery,
    priority: Priority,
    tree_order: Cesium3dTilesTreeOrder,
    is_v1_1: bool,
) -> bool {
    let data_requester_entity_id = tile.data_requester_id;
    if let Some(id) = data_requester_entity_id
        && requesters.contains(id)
    {
        return false;
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
                    tree_order,
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
                    tree_order,
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
        DataRequesterExtension::Glb if is_v1_1 => {
            let id = commands
                .spawn((
                    Cesium3dTileContentDataRequesterMarker,
                    GltfFeaturesDataRequesterMarker,
                    priority,
                    tree_order,
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
        DataRequesterExtension::Glb => {
            let id = commands
                .spawn((
                    Cesium3dTileContentDataRequesterMarker,
                    GlbDataRequesterMarker,
                    priority,
                    tree_order,
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
        DataRequesterExtension::Gltf if is_v1_1 => {
            let id = commands
                .spawn((
                    Cesium3dTileContentDataRequesterMarker,
                    GltfFeaturesDataRequesterMarker,
                    priority,
                    tree_order,
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
