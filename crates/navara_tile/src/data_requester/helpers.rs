use std::str::FromStr;

use bevy_ecs::system::Commands;
use navara_buffer_store::BufferStore;
use navara_component::{OrderByDistance, Priority, Requested};
use navara_core::tile_url;
use navara_data_requester::{DataManager, DataRequester, DataRequesterExtension};
use navara_layer::{TerrainDataType, TerrainLayer};
use navara_tile_component::{
    RasterDEMData, RasterTile, TerrainData, TerrainDataRequesterMarker, TileHandle,
    TileTerrainDataRequesterQuery,
};

#[allow(clippy::too_many_arguments)]
pub(crate) fn request_terrain_data(
    commands: &mut Commands,
    tile: &mut RasterTile,
    buf: &mut BufferStore,
    data_manager: &mut DataManager,
    terrain_layer: &Option<&TerrainLayer>,
    handle: TileHandle,
    terrain_data_requester: &TileTerrainDataRequesterQuery,
    priority: Priority,
) {
    let data_requester_entity_id = tile
        .terrain_data
        .as_ref()
        .and_then(|t| t.data_requester_entity_id());
    if matches!(data_requester_entity_id, Some(e) if terrain_data_requester.contains(e)) {
        return;
    }
    if let Some(t) = terrain_layer {
        // Skip data loading for terrain types that don't need it
        match &t.terrain_type {
            TerrainDataType::Ellipsoid => return, // Ellipsoid terrain doesn't need data loading
            TerrainDataType::Unknown => return,
            _ => {}
        }

        let url = tile_url(t.data.as_ref().unwrap().url.as_str(), &tile.coords, false);
        let mut terrain_data = match &t.terrain_type {
            TerrainDataType::RasterDEM => {
                RasterDEMData::new(*t.appearance.as_ref().unwrap().elevation_decoder().unwrap())
            } // DEM
            // TODO: Support quantized-mesh
            TerrainDataType::QuantizedMesh => unimplemented!(), // quantized-mesh
            TerrainDataType::Ellipsoid | TerrainDataType::Unknown => unreachable!(),
        };
        let extension = DataRequesterExtension::from_url(&url::Url::from_str(&url).unwrap());

        // Spawn entity first to get entity ID
        let entity_id = commands.spawn_empty().id();

        // Register with DataManager to get shared handle.
        // is_new=true means this is the first consumer for this URL.
        // fetch_already_enqueued=true means another consumer already triggered a fetch.
        let (shared_handle, is_new, fetch_already_enqueued) =
            data_manager.register_consumer(url.clone(), entity_id, buf);

        // Check if data already exists in BufferStore (loaded by previous consumer)
        let data_exists = buf.get_u8(&shared_handle).is_some();

        // Determine initial status: Success if data already loaded, otherwise Pending
        let initial_status = if !is_new && data_exists {
            navara_data_requester::DataRequesterStatus::Success
        } else {
            navara_data_requester::DataRequesterStatus::Pending
        };

        // Check if we should wait for an in-flight fetch before moving initial_status
        let should_wait_for_fetch = fetch_already_enqueued
            && initial_status == navara_data_requester::DataRequesterStatus::Pending;

        // Insert components with shared handle.
        let mut entity_commands = commands.entity(entity_id);
        entity_commands.insert((
            TerrainDataRequesterMarker(handle),
            DataRequester::new_with_status(shared_handle, url, extension, initial_status),
            OrderByDistance {
                sse: tile.sse,
                distance: tile.distance_from_camera,
            },
            priority,
        ));

        // If another consumer already enqueued a fetch AND we're still pending,
        // insert Requested marker so this consumer waits for the shared fetch.
        if should_wait_for_fetch {
            entity_commands.insert(Requested);
        }

        terrain_data.set_data_requester_entity_id(Some(entity_id));
        tile.terrain_data = Some(Box::new(terrain_data));
    }
}
