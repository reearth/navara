use crate::terrain::{RasterDEMData, TerrainData};
use bevy_ecs::{entity::Entity, system::Commands};
use navara_buffer_store::BufferStore;
use navara_component::Priority;
use navara_core::tile_url;
use navara_data_requester::{DataRequester, DataRequesterExtension};
use navara_layer::{TerrainDataType, TerrainLayer};
use navara_math::FloatType;

use crate::{tile::render::TileOrderByDistance, tile::TileHandle, TileQuadtree};

use super::{TerrainDataRequesterMarker, TileTerrainDataRequesterQuery};

pub(crate) fn request_terrain_data(
    commands: &mut Commands,
    qt: &mut TileQuadtree,
    buf: &mut BufferStore,
    terrain_layer: &Option<&TerrainLayer>,
    handle: TileHandle,
    tile_distance: FloatType,
    terrain_data_requester: &TileTerrainDataRequesterQuery,
) -> Option<Entity> {
    let tile = qt.qt.get_mut(handle).unwrap();
    let data_requester_entity_id = tile
        .terrain_data
        .as_ref()
        .and_then(|t| t.data_requester_entity_id());
    if matches!(data_requester_entity_id, Some(e) if terrain_data_requester.contains(e)) {
        return None;
    }
    match terrain_layer {
        Some(t) => {
            let url = tile_url(&t.url, &tile.coords);
            let mut terrain_data = match &t.terrain_type {
                TerrainDataType::RasterDEM => RasterDEMData {
                    decoder: t.elevation_decoder.clone(),
                    ..Default::default()
                }, // DEM
                // TODO: Support quantized-mesh
                TerrainDataType::QuantizedMesh => unimplemented!(), // quantized-mesh
                TerrainDataType::Unknown => return None,
            };
            let entity = commands.spawn((
                TerrainDataRequesterMarker(handle),
                Priority::High,
                DataRequester::from_store(url, buf, DataRequesterExtension::Png),
                TileOrderByDistance(tile_distance),
            ));
            let id = entity.id();
            terrain_data.set_data_requester_entity_id(Some(id));
            tile.terrain_data = Some(Box::new(terrain_data));
            Some(id)
        }
        None => None,
    }
}
