//! Integration tests corresponding to `full.test.ts` from the JS geojson-vt test suite.
//!
//! All `testTiles` calls become exact fixture matches via `assert_tiles_match()`.
//! Options match the JS `genTiles` defaults exactly.

mod common;

use std::collections::HashMap;

use common::*;
use navara_geojson_vt::{GeoJsonVt, Options};

fn load_tile_map(name: &str) -> HashMap<String, Vec<JsFeature>> {
    let data = std::fs::read_to_string(fixture_path(name)).unwrap();
    serde_json::from_str(&data).unwrap()
}

/// Builds a tile key string matching the JS convention: `z{z}-{x}-{y}`.
fn tile_key_str(tile: &Tile) -> String {
    format!("z{}-{}-{}", tile.z, tile.x, tile.y)
}

/// Collects all tiles from the index into a map keyed by `z{z}-{x}-{y}`.
fn collect_tile_map(index: &GeoJsonVt) -> HashMap<String, &Tile> {
    index.tiles().map(|t| (tile_key_str(t), t)).collect()
}

/// Asserts all tiles from the index match the fixture exactly.
fn assert_tiles_match(index: &GeoJsonVt, expected_name: &str) {
    let expected = load_tile_map(expected_name);
    let actual = collect_tile_map(index);

    // Check that all expected tiles exist
    for (key, js_features) in &expected {
        if js_features.is_empty() {
            // JS creates tiles for empty quadrants; Rust skips them.
            // An absent tile is equivalent to one with 0 features.
            if let Some(tile) = actual.get(key) {
                assert!(
                    tile.features.is_empty(),
                    "Expected empty tile {key} but got {} features",
                    tile.features.len()
                );
            }
            continue;
        }
        let tile = actual
            .get(key)
            .unwrap_or_else(|| panic!("Missing tile {key}"));
        assert_tile_features_match(tile, js_features);
    }

    // Check that no unexpected non-empty tiles exist
    for (key, tile) in &actual {
        if !expected.contains_key(key) {
            assert!(
                tile.features.is_empty(),
                "Unexpected non-empty tile {key} with {} features",
                tile.features.len()
            );
        }
    }
}

// ── Exact match tests ────────────────────────────────────────────────

#[test]
fn test_feature_tiles() {
    let geojson = load_geojson("feature.json");
    let index = GeoJsonVt::new(&geojson, gen_tiles_opts());
    assert_tiles_match(&index, "feature-tiles.json");
}

#[test]
fn test_collection_tiles() {
    let geojson = load_geojson("collection.json");
    let index = GeoJsonVt::new(&geojson, gen_tiles_opts());
    assert_tiles_match(&index, "collection-tiles.json");
}

#[test]
fn test_single_geom_tiles() {
    let geojson = load_geojson("single-geom.json");
    let index = GeoJsonVt::new(&geojson, gen_tiles_opts());
    assert_tiles_match(&index, "single-geom-tiles.json");
}

#[test]
fn test_dateline_tiles() {
    let geojson = load_geojson("dateline.json");
    let index = GeoJsonVt::new(&geojson, gen_tiles_opts());
    assert_tiles_match(&index, "dateline-tiles.json");
}

#[test]
fn test_us_states_tiles() {
    let geojson = load_geojson("us-states.json");
    let index = GeoJsonVt::new(
        &geojson,
        Options {
            index_max_zoom: 7,
            index_max_points: 200,
            ..gen_tiles_opts()
        },
    );
    assert_tiles_match(&index, "us-states-tiles.json");
}

// ── Empty / null / edge-case tests (exact) ───────────────────────────

#[test]
fn test_empty_collection() {
    let geojson = load_geojson("empty.json");
    let index = GeoJsonVt::new(&geojson, gen_tiles_opts());
    assert_eq!(
        index.tile_count(),
        0,
        "Empty collection should produce 0 tiles"
    );
}

#[test]
fn test_null_geometry() {
    let geojson = load_geojson("feature-null-geometry.json");
    let index = GeoJsonVt::new(&geojson, gen_tiles_opts());
    assert_eq!(
        index.tile_count(),
        0,
        "Null geometry should produce 0 tiles"
    );
}

#[test]
fn test_empty_coords() {
    let geojson = load_geojson("empty-coords.json");
    let index = GeoJsonVt::new(&geojson, gen_tiles_opts());
    assert_eq!(
        index.tile_count(),
        0,
        "Empty coordinates should produce 0 tiles"
    );
}
