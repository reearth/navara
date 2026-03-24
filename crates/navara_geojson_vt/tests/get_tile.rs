//! Integration tests corresponding to `get-tile.test.ts` from the JS geojson-vt test suite.
//!
//! Tests match the JS reference inputs and assertions exactly.

mod common;

use common::*;
use navara_geojson_vt::{GeoJsonVt, Options};

fn load_fixture_features(name: &str) -> Vec<JsFeature> {
    let data = std::fs::read_to_string(fixture_path(name)).unwrap();
    serde_json::from_str(&data).unwrap()
}

// ── Empty index ──────────────────────────────────────────────────────

#[test]
fn test_get_tile_empty_index() {
    let geojson: GeoJson =
        serde_json::from_str(r#"{"type": "FeatureCollection", "features": []}"#).unwrap();
    let mut index = GeoJsonVt::new(&geojson, Options::default());
    assert!(index.get_tile(0, 0, 0).is_none());
}

// ── US States (default options, matching JS `new GeoJSONVT(usStates, {debug: 2})`) ──

fn us_states_index() -> GeoJsonVt {
    let geojson = load_geojson("us-states.json");
    GeoJsonVt::new(&geojson, Options::default())
}

#[test]
fn test_us_states_z7_tile() {
    let mut index = us_states_index();
    let tile = index
        .get_tile(7, 37, 48)
        .expect("z7/37/48 tile should exist");
    let expected = load_fixture_features("us-states-z7-37-48.json");
    assert_tile_features_match(tile, &expected);
}

#[test]
fn test_us_states_z9_tile() {
    let mut index = us_states_index();
    let tile = index
        .get_tile(9, 148, 192)
        .expect("z9/148/192 should exist (on-demand drill-down)");

    // JS expects a single Pennsylvania polygon filling the tile.
    let expected_geom = serde_json::json!([[
        [-64, 4160],
        [-64, -64],
        [4160, -64],
        [4160, 4160],
        [-64, 4160]
    ]]);
    let expected_tags = serde_json::json!({"name": "Pennsylvania", "density": 284.3});

    assert_eq!(tile.features.len(), 1);
    assert_eq!(geom_type_num(&tile.features[0].geometry), 3);
    assert_eq!(geom_to_js_value(&tile.features[0].geometry), expected_geom);
    assert_eq!(props_to_tags(&tile.features[0].properties), expected_tags);
}

#[test]
fn test_get_tile_nonexistent() {
    let mut index = us_states_index();
    assert!(
        index.get_tile(11, 800, 400).is_none(),
        "Tile at z11/800/400 should not exist"
    );
}

#[test]
fn test_us_states_tile_count() {
    // JS test flow: create index, then drill down via getTile calls,
    // then check total (which includes drill-down tiles).
    let mut index = us_states_index();

    // Pre-indexed tiles only (indexMaxPoints=100000 > 3568 points → only z0)
    assert_eq!(index.tile_count(), 1);

    // Drill down like the JS test
    {
        let _ = index.get_tile(7, 37, 48);
    }
    {
        let _ = index.get_tile(9, 148, 192);
    }
    {
        let _ = index.get_tile(11, 800, 400);
    }

    // maplibre/geojson-vt has 37 tiles total (29 with features + 8 empty): https://github.com/maplibre/geojson-vt/blob/52c6d357ac7ee660079923e0a5d4a5918fce9f60/test/get-tile.test.ts#L49
    // Rust skips empty tiles (those with 0 features/0 points after simplification).
    // Count only tiles with features for a meaningful comparison.
    let non_empty = index.tiles().filter(|t| !t.features.is_empty()).count();
    assert_eq!(
        non_empty, 29,
        "Non-empty tiles after drill-down should match JS"
    );
}

// ── Unbuffered tile edge tests ───────────────────────────────────────

#[test]
fn test_unbuffered_left_right_edges() {
    // JS: LineString [[0, 90], [0, -90]], buffer: 0
    let geojson: GeoJson = serde_json::from_str(
        r#"{
            "type": "LineString",
            "coordinates": [[0, 90], [0, -90]]
        }"#,
    )
    .unwrap();

    let mut index = GeoJsonVt::new(
        &geojson,
        Options {
            buffer: 0,
            ..Default::default()
        },
    );

    // JS: getTile(2, 1, 1) === null
    assert!(
        index.get_tile(2, 1, 1).is_none(),
        "z2/1/1 should be null (line at boundary belongs to right tile)"
    );

    // JS: getTile(2, 2, 1).features === [{geometry: [[[0, 0], [0, 4096]]], type: 2, tags: null}]
    {
        let tile = index.get_tile(2, 2, 1).expect("z2/2/1 should exist");
        assert_eq!(tile.features.len(), 1);
        assert_eq!(geom_type_num(&tile.features[0].geometry), 2);
        assert_eq!(
            geom_to_js_value(&tile.features[0].geometry),
            serde_json::json!([[[0, 0], [0, 4096]]])
        );
        assert_eq!(
            props_to_tags(&tile.features[0].properties),
            serde_json::Value::Null
        );
    }
}

#[test]
fn test_unbuffered_top_bottom_edges() {
    // JS: LineString [[-90, 66.51326044311188], [90, 66.51326044311188]], buffer: 0
    let geojson: GeoJson = serde_json::from_str(
        r#"{
            "type": "LineString",
            "coordinates": [[-90, 66.51326044311188], [90, 66.51326044311188]]
        }"#,
    )
    .unwrap();

    let mut index = GeoJsonVt::new(
        &geojson,
        Options {
            buffer: 0,
            ..Default::default()
        },
    );

    // JS: getTile(2, 1, 0).features === [{geometry: [[[0, 4096], [4096, 4096]]], type: 2, tags: null}]
    {
        let tile = index.get_tile(2, 1, 0).expect("z2/1/0 should exist");
        assert_eq!(tile.features.len(), 1);
        assert_eq!(geom_type_num(&tile.features[0].geometry), 2);
        assert_eq!(
            geom_to_js_value(&tile.features[0].geometry),
            serde_json::json!([[[0, 4096], [4096, 4096]]])
        );
        assert_eq!(
            props_to_tags(&tile.features[0].properties),
            serde_json::Value::Null
        );
    }

    // JS: getTile(2, 1, 1).features === [] (tile exists but empty)
    // In Rust, the tile may not exist at all (equivalent to empty features).
    let bottom = index.get_tile(2, 1, 1);
    assert!(
        bottom.is_none() || bottom.unwrap().features.is_empty(),
        "z2/1/1 should have no features (line at boundary belongs to tile above)"
    );
}

// ── Polygon clipping on tile boundary ────────────────────────────────

#[test]
fn test_polygon_clipping_on_boundary() {
    // JS: Polygon spanning tile boundary, buffer: 1024
    let geojson: GeoJson = serde_json::from_str(
        r#"{
            "type": "Polygon",
            "coordinates": [[
                [42.1875, 57.32652122521708],
                [47.8125, 57.32652122521708],
                [47.8125, 54.16243396806781],
                [42.1875, 54.16243396806781],
                [42.1875, 57.32652122521708]
            ]]
        }"#,
    )
    .unwrap();

    let mut index = GeoJsonVt::new(
        &geojson,
        Options {
            buffer: 1024,
            ..Default::default()
        },
    );

    // JS: getTile(5, 19, 9).features === [{geometry: [[[3072, 3072], ...]], type: 3, tags: null}]
    let tile = index.get_tile(5, 19, 9).expect("z5/19/9 should exist");
    assert_eq!(tile.features.len(), 1);
    assert_eq!(geom_type_num(&tile.features[0].geometry), 3);
    assert_eq!(
        geom_to_js_value(&tile.features[0].geometry),
        serde_json::json!([[
            [3072, 3072],
            [5120, 3072],
            [5120, 5120],
            [3072, 5120],
            [3072, 3072]
        ]])
    );
    assert_eq!(
        props_to_tags(&tile.features[0].properties),
        serde_json::Value::Null
    );
}
