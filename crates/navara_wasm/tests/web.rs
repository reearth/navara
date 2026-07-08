//! Test suite for the Web and headless browsers.

#![cfg(target_arch = "wasm32")]

extern crate wasm_bindgen_test;
use wasm_bindgen_test::*;

wasm_bindgen_test_configure!(run_in_browser);

#[wasm_bindgen_test]
fn pass() {
    assert_eq!(1 + 1, 2);
}

/// The parse worker serializes the tile meta with 64-bit integers as BigInt
/// (`navara_wasm_worker::task::parse_mvt_tile`), so values beyond the JS
/// safe-integer range survive; the main-thread side deserializes them back
/// (`ParseMvtTileResult::new`). Round-trip through the same pair to guarantee
/// they stay compatible.
#[wasm_bindgen_test]
fn it_should_round_trip_mvt_meta_values_beyond_the_js_safe_integer_range() {
    use navara_parser::mvt::{MvtValue, ParsedLayerPropertiesMeta, ParsedMvtTileMeta};
    use serde::Serialize;

    let meta = ParsedMvtTileMeta {
        headers: Vec::new(),
        layer_properties: vec![ParsedLayerPropertiesMeta {
            keys: vec!["id".to_string(), "count".to_string(), "offset".to_string()],
            values: vec![
                MvtValue::UInt(u64::MAX),
                MvtValue::Int(i64::MIN),
                MvtValue::SInt(i64::MAX),
            ],
        }],
    };

    let js = meta
        .serialize(
            &serde_wasm_bindgen::Serializer::new().serialize_large_number_types_as_bigints(true),
        )
        .unwrap();
    let roundtripped: ParsedMvtTileMeta = serde_wasm_bindgen::from_value(js).unwrap();

    assert_eq!(roundtripped.layer_properties, meta.layer_properties);
}
