//! Integration tests corresponding to `multi-world.test.ts` from the JS geojson-vt test suite.
//!
//! Tests that points placed at longitudes ±540 are correctly wrapped
//! and appear at the expected positions in extent-space coordinates.
//!
//! JS checks internal [0,1] coords; Rust stores extent-space (4096) coords.
//! JS [1, 0.5] → Rust [4096, 2048]; JS [0, 0.5] → Rust [0, 2048].

use geojson_lib::GeoJson;
use navara_geojson_vt::types::TileGeometry;
use navara_geojson_vt::{GeoJsonVt, Options};

/// Extracts the first point coordinate from the first feature of z0/0/0 tile.
fn get_first_point(geojson: &GeoJson) -> [f64; 2] {
    let mut index = GeoJsonVt::new(
        geojson,
        Options {
            index_max_zoom: 0,
            ..Default::default()
        },
    );
    let tile = index
        .get_tile(0, 0, 0)
        .expect("z0 tile should exist");
    for f in &tile.features {
        if let TileGeometry::Points(pts) = &f.geometry {
            return pts[0];
        }
    }
    panic!("No point feature found in z0 tile");
}

#[test]
fn test_multi_world_right_point() {
    // JS: Point [540, 0] → internal coords [1, 0.5] → extent-space [4096, 2048]
    let geojson: GeoJson = serde_json::from_str(
        r#"{
            "type": "Feature",
            "properties": {},
            "geometry": {
                "coordinates": [540, 0],
                "type": "Point"
            }
        }"#,
    )
    .unwrap();

    let pt = get_first_point(&geojson);
    assert_eq!(pt[0].round() as i64, 4096);
    assert_eq!(pt[1].round() as i64, 2048);
}

#[test]
fn test_multi_world_left_point() {
    // JS: Point [-540, 0] → internal coords [0, 0.5] → extent-space [0, 2048]
    let geojson: GeoJson = serde_json::from_str(
        r#"{
            "type": "Feature",
            "properties": {},
            "geometry": {
                "coordinates": [-540, 0],
                "type": "Point"
            }
        }"#,
    )
    .unwrap();

    let pt = get_first_point(&geojson);
    assert_eq!(pt[0].round() as i64, 0);
    assert_eq!(pt[1].round() as i64, 2048);
}

#[test]
fn test_multi_world_both_points() {
    // JS: FeatureCollection with [-540, 0] + [540, 0]
    // JS asserts: features[0] = [0, 0.5], features[1] = [1, 0.5]
    // Rust extent-space: features[0] = [0, 2048], features[1] = [4096, 2048]
    let geojson: GeoJson = serde_json::from_str(
        r#"{
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "properties": {},
                    "geometry": {"coordinates": [-540, 0], "type": "Point"}
                },
                {
                    "type": "Feature",
                    "properties": {},
                    "geometry": {"coordinates": [540, 0], "type": "Point"}
                }
            ]
        }"#,
    )
    .unwrap();

    let mut index = GeoJsonVt::new(
        &geojson,
        Options {
            index_max_zoom: 0,
            ..Default::default()
        },
    );
    let tile = index
        .get_tile(0, 0, 0)
        .expect("z0 tile should exist");
    assert_eq!(tile.features.len(), 2);

    // Extract point coordinates from each feature
    let pt0 = match &tile.features[0].geometry {
        TileGeometry::Points(pts) => pts[0],
        _ => panic!("Expected Points geometry for feature 0"),
    };
    let pt1 = match &tile.features[1].geometry {
        TileGeometry::Points(pts) => pts[0],
        _ => panic!("Expected Points geometry for feature 1"),
    };

    assert_eq!(pt0[0].round() as i64, 0);
    assert_eq!(pt0[1].round() as i64, 2048);
    assert_eq!(pt1[0].round() as i64, 4096);
    assert_eq!(pt1[1].round() as i64, 2048);
}
