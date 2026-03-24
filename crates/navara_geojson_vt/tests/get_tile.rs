//! Integration tests corresponding to `get-tile.test.ts` from the JS geojson-vt test suite.
//!
//! Tests match the JS reference inputs and assertions exactly.
//! Some tests will fail until `index_max_points` logic and on-demand tile
//! generation are implemented.

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

fn load_fixture_features(name: &str) -> Vec<JsFeature> {
    let data = std::fs::read_to_string(fixture_path(name)).unwrap();
    serde_json::from_str(&data).unwrap()
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

/// Full comparison of a tile's features against JS-format features (ignoring `id`).
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
