use bevy_ecs::{component::Component, entity::Entity, system::Commands};
use bevy_log::{error, warn};
use navara_buffer_store::BufferStore;
use navara_component::Priority;
use navara_data_requester::{DataRequester, DataRequesterExtension, RequestOrder};
use url::Url;

use crate::{
    Cesium3dTileContent, TileOrderByDistance, b3dm::B3dmDataRequesterMarker,
    cesium3dtiles::types::Cesium3dTileContentRequesterQuery, glb::GlbDataRequesterMarker,
    gltf_features::GltfFeaturesDataRequesterMarker, pnts::PntsDataRequesterMarker,
};

#[derive(Component)]
pub struct Cesium3dTilesMetadataDataRequesterMarker(pub Entity);

#[derive(Component)]
pub struct Cesium3dTileContentDataRequesterMarker;

/// Layer (tileset) entity that owns a content data requester, attached at
/// spawn so the dispatch-time reservation (`filter_requestable_data_requester`)
/// can key the per-tileset cost estimator — different tilesets have wildly
/// different content sizes, so their landed-cost statistics must not be
/// pooled globally.
#[derive(Component, Clone, Copy)]
pub struct Cesium3dTileContentLayerId(pub Entity);

/// Marker for the [`DataRequester`] that fetches a *nested* `tileset.json`.
///
/// Distinguishes nested-tileset metadata requesters from the layer's root
/// metadata requester so `construct_cesium_3d_tiles_tree` can route them
/// differently (root → spawn tree entity; nested → insert into the
/// [`Cesium3dTilesNestedTreeMap`](crate::Cesium3dTilesNestedTreeMap)).
#[derive(Component)]
pub struct Cesium3dTilesNestedMetadataDataRequesterMarker;

// TODO: Request again if the request failed.
#[allow(clippy::too_many_arguments)]
pub(crate) fn request_tile_content(
    commands: &mut Commands,
    buf: &mut BufferStore,
    base_url: &Url,
    tile: &mut Cesium3dTileContent,
    requesters: &Cesium3dTileContentRequesterQuery,
    priority: Priority,
    is_v1_1: bool,
    layer_id: Entity,
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
    let request_order = RequestOrder(TileOrderByDistance {
        distance_from_camera: tile.state.distance_from_camera,
        sse: tile.state.sse,
    });
    match extension {
        DataRequesterExtension::Pnts => {
            let id = commands
                .spawn((
                    Cesium3dTileContentDataRequesterMarker,
                    Cesium3dTileContentLayerId(layer_id),
                    PntsDataRequesterMarker,
                    priority,
                    request_order,
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
                    Cesium3dTileContentLayerId(layer_id),
                    B3dmDataRequesterMarker,
                    priority,
                    request_order,
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
                    Cesium3dTileContentLayerId(layer_id),
                    GltfFeaturesDataRequesterMarker,
                    priority,
                    request_order,
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
                    Cesium3dTileContentLayerId(layer_id),
                    GlbDataRequesterMarker,
                    priority,
                    request_order,
                    DataRequester::from_store(content_url, buf, extension),
                ))
                .id();
            tile.data_requester_id = Some(id);
            true
        }
        DataRequesterExtension::Gltf => {
            // Plain .gltf files (JSON + external .bin buffers) are not yet supported.
            // Only GLB (binary glTF container) is supported.
            warn!(
                "Plain .gltf format is not yet supported, only .glb is supported. Skipping tile: {}",
                content_url
            );
            false
        }
        _ => false,
    }
}
