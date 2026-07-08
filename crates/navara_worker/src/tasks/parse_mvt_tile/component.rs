use bevy_ecs::component::Component;
use navara_buffer_store::{BufferStore, Handle};
use navara_core::{Extent, Radians};
use navara_math::FloatType;
use navara_parser::mvt::{LayerParseConfig, ParsedMvtTileMeta};

use crate::component::WorkerTaskBundle;

#[derive(Component)]
pub struct ParseMvtTileMarker;

/// Worker inputs for parsing an MVT tile. Carries only what the (off-thread)
/// parse core needs; the main-thread finalize context lives separately on the
/// delegator entity (see `navara_mvt`).
#[derive(Component, Clone, Debug)]
pub struct ParseMvtTileParameters {
    /// BufferStore handle to the raw pbf bytes.
    pub pbf_handle: Handle,
    pub x: usize,
    pub y: usize,
    pub z: usize,
    pub tile_extent: Option<Extent<FloatType, Radians>>,
    pub configs: Vec<LayerParseConfig>,
    /// Tile-payload compression code (0 = none/plain, see
    /// `navara_parser::pmtiles::compression_from_code`). The worker decompresses
    /// before parsing, so gzip (PMTiles) is handled off the main thread too.
    pub compression: u8,
}

/// The parsed tile returned by the worker, awaiting finalization.
///
/// The bulk geometry lives in the `BufferStore` as four packed per-type
/// streams (see `navara_parser::mvt::pack_parsed_mvt_groups` for the segment
/// order); this component carries only their handles plus the tile meta
/// (per-group headers and one property table per layer), keeping ECS storage
/// and event cloning cheap. Whoever consumes or discards this component must
/// free the streams via [`take_streams`] or [`remove_from_buf`] — the handles
/// are not reference-counted.
///
/// [`take_streams`]: ParseMvtTileResult::take_streams
/// [`remove_from_buf`]: ParseMvtTileResult::remove_from_buf
#[derive(Component, Clone, Debug)]
pub struct ParseMvtTileResult {
    pub f64_handle: Handle,
    pub f32_handle: Handle,
    pub u32_handle: Handle,
    pub u8_handle: Handle,
    pub meta: ParsedMvtTileMeta,
}

impl ParseMvtTileResult {
    /// Take ownership of the four packed streams for finalization, removing
    /// their `BufferStore` entries.
    pub fn take_streams(&self, buf: &mut BufferStore) -> (Vec<f64>, Vec<f32>, Vec<u32>, Vec<u8>) {
        (
            buf.remove_f64(&self.f64_handle).unwrap_or_default(),
            buf.remove_f32(&self.f32_handle).unwrap_or_default(),
            buf.remove_u32(&self.u32_handle).unwrap_or_default(),
            buf.remove_u8(&self.u8_handle).unwrap_or_default(),
        )
    }

    /// Free the stream buffers without reading them (leak-prevention path for
    /// results whose delegator disappeared before finalization).
    pub fn remove_from_buf(&self, buf: &mut BufferStore) {
        buf.remove(&self.f64_handle);
        buf.remove(&self.f32_handle);
        buf.remove(&self.u32_handle);
        buf.remove(&self.u8_handle);
    }
}

pub type ParseMvtTileWorkerTaskBundle =
    WorkerTaskBundle<ParseMvtTileMarker, ParseMvtTileParameters>;
