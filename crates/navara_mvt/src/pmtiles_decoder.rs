//! [`MvtPmtilesDecoder`]: the MVT payload decoder injected into a
//! `navara_pmtiles::PmtilesSource`. It reuses the exact MVT decode path used for
//! `{z}/{x}/{y}` tiles, so a PMTiles archive carrying MVT renders identically to
//! a templated MVT source.

use std::any::Any;

use bevy_ecs::{entity::Entity, system::Commands};
use navara_buffer_store::BufferStore;
use navara_component::OrderByDistance;
use navara_feature_component::batch::BatchTable;
use navara_pmtiles::TilePayloadDecoder;
use navara_tile_component::{TileHandle, VectorTile};

use crate::{
    geometry::{MatchedLayerInfo, construct_geometry_multi_layer},
    source::OwnedMatchedLayerInfo,
};

/// Decodes MVT tile payloads pulled from a PMTiles archive into geometry.
pub struct MvtPmtilesDecoder {
    /// Per-layer styling/filtering, identical to what `MvtSource` holds.
    pub layers: Vec<OwnedMatchedLayerInfo>,
}

impl TilePayloadDecoder for MvtPmtilesDecoder {
    fn as_any_mut(&mut self) -> &mut dyn Any {
        self
    }

    fn decode(
        &self,
        commands: &mut Commands,
        batch_table: &mut BatchTable,
        buf: &mut BufferStore,
        payload: Vec<u8>,
        tile: &VectorTile,
        tile_handle: TileHandle,
        order: &OrderByDistance,
    ) -> Option<Vec<Entity>> {
        let matched_layers: Vec<MatchedLayerInfo> = self
            .layers
            .iter()
            .map(OwnedMatchedLayerInfo::as_ref)
            .collect();

        construct_geometry_multi_layer(
            commands,
            batch_table,
            buf,
            payload,
            tile.coords,
            &matched_layers,
            Some((tile_handle, tile.extent)),
            order,
        )
    }
}
