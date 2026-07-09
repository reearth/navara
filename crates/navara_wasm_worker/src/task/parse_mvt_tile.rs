use navara_core::{Aabb, Extent, Radians, TileXYZ};
use navara_math::{FloatType, Vec3};
use navara_parser::mvt::{
    LayerParseConfig, pack_parsed_mvt_groups, parse_mvt_tile as parse_mvt_tile_core,
};
use navara_wasm_types::{ExtentRadianF32, mvt::TransferableParsedMvtResult};
use serde::Serialize;
use wasm_bindgen::prelude::*;

/// Parse an MVT tile off the main thread.
///
/// `mvt_bin` is the raw pbf, `configs` is a serialized `Vec<LayerParseConfig>`
/// (one per matched target layer), and `tile_extent` (when present) yields the
/// RTC center for point encoding. The parsed groups are packed into four
/// per-type streams (`pack_parsed_mvt_groups`) so the caller transfers exactly
/// four buffers back to the main thread; the tile meta (per-group headers +
/// per-layer property tables) rides along as a structured clone.
#[wasm_bindgen(js_name = parseMvtTile)]
pub fn parse_mvt_tile(
    mvt_bin: Vec<u8>,
    x: usize,
    y: usize,
    z: usize,
    tile_extent: Option<ExtentRadianF32>,
    compression: u8,
    configs_json: &str,
) -> Result<TransferableParsedMvtResult, JsValue> {
    let configs: Vec<LayerParseConfig> =
        serde_json::from_str(configs_json).map_err(|e| JsValue::from_str(&e.to_string()))?;

    // Decompress off the main thread (e.g. gzip'd PMTiles tiles). Code 0 is a
    // no-op passthrough, so plain MVT pays nothing. A failed decompression
    // packs zero groups so the caller still receives well-formed (empty)
    // streams and headers.
    let groups = match navara_parser::pmtiles::decompress_by_code(compression, mvt_bin) {
        Some(mvt_bin) => {
            let rtc_center = tile_extent
                .map(|e| {
                    let extent: Extent<FloatType, Radians> = e.into();
                    Aabb::from_extent_f64(extent, 0., 1.).center
                })
                .unwrap_or(Vec3::ZERO);
            let xyz = TileXYZ { x, y, z };
            parse_mvt_tile_core(&mvt_bin, xyz, rtc_center, &configs)
        }
        None => Vec::new(),
    };
    let packed = pack_parsed_mvt_groups(groups);

    // i64/u64 property values (e.g. 64-bit feature ids) can exceed the JS
    // safe-integer range; the default serializer errors on those, which would
    // reject the whole tile. BigInts round-trip losslessly (the deserializer
    // on the main-thread side accepts both Number and BigInt).
    let meta = packed.meta.serialize(
        &serde_wasm_bindgen::Serializer::new().serialize_large_number_types_as_bigints(true),
    )?;
    Ok(TransferableParsedMvtResult::new(
        packed.f64_stream,
        packed.f32_stream,
        packed.u32_stream,
        packed.u8_stream,
        meta,
    ))
}
