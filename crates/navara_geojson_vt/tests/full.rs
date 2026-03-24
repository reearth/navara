//! Integration tests corresponding to `full.test.ts` from the JS geojson-vt test suite.
//!
//! All `testTiles` calls become exact fixture matches via `assert_tiles_match()`.
//! Options match the JS `genTiles` defaults exactly.

use std::collections::HashMap;

use geojson_lib::GeoJson;
use navara_geojson_vt::types::{Tile, TileGeometry};
use navara_geojson_vt::{GeoJsonVt, Options};
use serde::Deserialize;

// ── Fixture helpers ──────────────────────────────────────────────────

fn fixture_path(name: &str) -> std::path::PathBuf {
    std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("tests")
        .join("fixtures")
        .join(name)
}

fn load_geojson(name: &str) -> GeoJson {
    let data = std::fs::read_to_string(fixture_path(name)).unwrap();
    serde_json::from_str(&data).unwrap()
}

/// JS fixture feature format.
#[derive(Debug, Deserialize)]
struct JsFeature {
    geometry: serde_json::Value,
    #[serde(rename = "type")]
    geom_type: u8,
    tags: serde_json::Value,
}

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

/// Returns the JS type number for a TileGeometry.
fn geom_type_num(geom: &TileGeometry) -> u8 {
    match geom {
        TileGeometry::Points(_) => 1,
        TileGeometry::Lines(_) => 2,
        TileGeometry::Polygons(_) => 3,
    }
}

/// Converts a Rust TileGeometry to the JS fixture format (with rounded coordinates).
fn geom_to_js_value(geom: &TileGeometry) -> serde_json::Value {
    match geom {
        TileGeometry::Points(pts) => {
            let arr: Vec<serde_json::Value> = pts
                .iter()
                .map(|p| serde_json::json!([p[0].round() as i64, p[1].round() as i64]))
                .collect();
            serde_json::Value::Array(arr)
        }
        TileGeometry::Lines(lines) => {
            let arr: Vec<serde_json::Value> = lines
                .iter()
                .map(|line| {
                    let pts: Vec<serde_json::Value> = line
                        .iter()
                        .map(|p| serde_json::json!([p[0].round() as i64, p[1].round() as i64]))
                        .collect();
                    serde_json::Value::Array(pts)
                })
                .collect();
            serde_json::Value::Array(arr)
        }
        TileGeometry::Polygons(polygons) => {
            // In JS, polygons are flattened to rings (no multi-polygon nesting in the tile output)
            let mut all_rings = Vec::new();
            for polygon in polygons {
                for ring in polygon {
                    let pts: Vec<serde_json::Value> = ring
                        .iter()
                        .map(|p| serde_json::json!([p[0].round() as i64, p[1].round() as i64]))
                        .collect();
                    all_rings.push(serde_json::Value::Array(pts));
                }
            }
            serde_json::Value::Array(all_rings)
        }
    }
}

/// Converts Rust properties to the JS `tags` format.
fn props_to_tags(props: &serde_json::Value) -> serde_json::Value {
    match props {
        serde_json::Value::Null => serde_json::Value::Null,
        other => other.clone(),
    }
}

/// Full comparison of a tile's features against the JS fixture (ignoring `id`).
fn assert_tile_features_match(tile: &Tile, expected: &[JsFeature]) {
    assert_eq!(
        tile.features.len(),
        expected.len(),
        "Feature count mismatch for tile z{}-{}-{}",
        tile.z,
        tile.x,
        tile.y
    );

    for (i, (rf, jf)) in tile.features.iter().zip(expected.iter()).enumerate() {
        assert_eq!(
            geom_type_num(&rf.geometry),
            jf.geom_type,
            "Feature {} type mismatch in tile z{}-{}-{}",
            i,
            tile.z,
            tile.x,
            tile.y
        );

        let rust_geom = geom_to_js_value(&rf.geometry);
        assert_eq!(
            rust_geom, jf.geometry,
            "Feature {} geometry mismatch in tile z{}-{}-{}",
            i, tile.z, tile.x, tile.y
        );

        let rust_tags = props_to_tags(&rf.properties);
        assert_eq!(
            rust_tags, jf.tags,
            "Feature {} tags mismatch in tile z{}-{}-{}",
            i, tile.z, tile.x, tile.y
        );
    }
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

/// Options matching JS `genTiles` defaults: `{indexMaxZoom: 0, indexMaxPoints: 10000}`.
fn gen_tiles_opts() -> Options {
    Options {
        index_max_zoom: 0,
        index_max_points: 10_000,
        ..Default::default()
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
            ..Default::default()
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
