use std::sync::Arc;

use navara_quadtree::{QuadLeafHandle, encode_quadleaf_handle};
use rustc_hash::FxHashMap;

use crate::Options;
use crate::clip::clip_to_quadrants;
use crate::tile::create_tile;
use crate::types::{InternalFeature, Tile};

/// Encode tile coordinates (x, y, z) into a [`QuadLeafHandle`] key for HashMap storage.
pub fn tile_key(x: u32, y: u32, z: u32) -> QuadLeafHandle {
    encode_quadleaf_handle((x, y, z)).expect("tile coordinates out of range")
}

/// Splits features into tiles, matching the JS `splitTile` function exactly.
///
/// When `target` is `None` (first-pass tiling), stops splitting when:
/// - `z == index_max_zoom`, or
/// - `tile.num_points <= index_max_points`
///
/// When `target` is `Some((cz, cx, cy))` (drill-down), stops splitting when:
/// - `z == max_zoom` or `z == cz`, or
/// - the tile is not an ancestor of the target
///
/// Leaf tiles store their source features in `sources` for on-demand drill-down.
#[allow(clippy::too_many_arguments)]
pub fn split_tile(
    features: Vec<Arc<InternalFeature>>,
    tiles: &mut FxHashMap<QuadLeafHandle, Tile>,
    sources: &mut FxHashMap<QuadLeafHandle, Vec<Arc<InternalFeature>>>,
    options: &Options,
    z: u32,
    x: u32,
    y: u32,
    target: Option<(u32, u32, u32)>,
) {
    let buffer_ratio = (options.buffer as f64) / (options.extent as f64);

    // Stack of (features, z, x, y)
    let mut stack: Vec<(Vec<Arc<InternalFeature>>, u32, u32, u32)> = vec![(features, z, x, y)];

    while let Some((tile_features, z, x, y)) = stack.pop() {
        if tile_features.is_empty() {
            continue;
        }

        let key = tile_key(x, y, z);

        let tile = create_tile(&tile_features, z, x, y, options);
        tiles.insert(key, tile);

        // Determine whether to stop splitting (mirrors JS stop conditions exactly)
        let should_stop = if let Some((cz, cx, cy)) = target {
            // Drill-down: stop at maxZoom or target zoom
            if z == options.max_zoom || z == cz {
                true
            } else {
                // Stop if not an ancestor of the target tile
                let zoom_steps = cz - z;
                x != cx >> zoom_steps || y != cy >> zoom_steps
            }
        } else {
            // First-pass: stop at indexMaxZoom or when tile has few enough points
            let tile = &tiles[&key];
            z == options.index_max_zoom || tile.num_points <= options.index_max_points
        };

        if should_stop {
            sources.insert(key, tile_features);
            continue;
        }

        // Continuing to split — remove source for this tile
        sources.remove(&key);

        // Split features into 4 quadrants
        let z2 = 1u32 << (z + 1);
        let buf = buffer_ratio / (z2 as f64);

        // Calculate tile boundaries in [0,1] space
        let tile_size = 1.0 / (z2 as f64);
        let x_min = (2 * x) as f64 * tile_size;
        let x_mid = x_min + tile_size;
        let x_max = x_min + 2.0 * tile_size;
        let y_min = (2 * y) as f64 * tile_size;
        let y_mid = y_min + tile_size;
        let y_max = y_min + 2.0 * tile_size;

        // Distribute features into 4 quadrants in a single pass
        let [tl, bl, tr, br] = clip_to_quadrants(
            &tile_features,
            x_min,
            x_mid,
            x_max,
            y_min,
            y_mid,
            y_max,
            buf,
        );

        if !tl.is_empty() {
            stack.push((tl, z + 1, 2 * x, 2 * y));
        }
        if !bl.is_empty() {
            stack.push((bl, z + 1, 2 * x, 2 * y + 1));
        }
        if !tr.is_empty() {
            stack.push((tr, z + 1, 2 * x + 1, 2 * y));
        }
        if !br.is_empty() {
            stack.push((br, z + 1, 2 * x + 1, 2 * y + 1));
        }
    }
}

#[cfg(test)]
mod tests {
    use std::sync::Arc;

    use super::*;
    use crate::convert::convert;
    use crate::types::InternalFeature;
    use geojson_lib::GeoJson;

    fn arc_features(geojson: &GeoJson) -> Vec<Arc<InternalFeature>> {
        convert(geojson, 0.0).into_iter().map(Arc::new).collect()
    }

    #[test]
    fn test_tile_key() {
        // Different tiles should produce different keys
        let k1 = tile_key(0, 0, 0);
        let k2 = tile_key(1, 0, 1);
        let k3 = tile_key(0, 1, 1);
        assert_ne!(k1, k2);
        assert_ne!(k2, k3);
    }

    #[test]
    fn test_split_single_feature_z0() {
        let geojson: GeoJson =
            serde_json::from_str(r#"{"type": "Point", "coordinates": [10, 20]}"#).unwrap();

        let features = arc_features(&geojson);
        let mut tiles = FxHashMap::default();
        let mut sources = FxHashMap::default();
        let options = Options {
            index_max_zoom: 0,
            ..Default::default()
        };

        split_tile(features, &mut tiles, &mut sources, &options, 0, 0, 0, None);

        // At indexMaxZoom=0, the z=0 tile should exist
        assert!(tiles.contains_key(&tile_key(0, 0, 0)));
        let tile = &tiles[&tile_key(0, 0, 0)];
        assert_eq!(tile.features.len(), 1);
    }

    #[test]
    fn test_features_in_correct_quadrant() {
        // A point at longitude 45, latitude 45 -> should be in the NE quadrant
        let geojson: GeoJson =
            serde_json::from_str(r#"{"type": "Point", "coordinates": [45, 45]}"#).unwrap();

        let features = arc_features(&geojson);
        let mut tiles = FxHashMap::default();
        let mut sources = FxHashMap::default();
        let options = Options {
            index_max_zoom: 1,
            index_max_points: 0, // Force splitting past z=0
            ..Default::default()
        };

        split_tile(features, &mut tiles, &mut sources, &options, 0, 0, 0, None);

        // x = project_x(45) = 45/360 + 0.5 = 0.625 -> in tile x=1
        // y = project_y(45) ≈ 0.36 -> in tile y=0
        let key = tile_key(1, 0, 1);
        assert!(tiles.contains_key(&key), "Expected tile at z=1, x=1, y=0");
    }

    #[test]
    fn test_drill_down_generates_target_tile() {
        // First-pass: index at z=0 only, storing source features
        let geojson: GeoJson =
            serde_json::from_str(r#"{"type": "Point", "coordinates": [0, 0]}"#).unwrap();

        let features = arc_features(&geojson);
        let mut tiles = FxHashMap::default();
        let mut sources = FxHashMap::default();
        let options = Options {
            index_max_zoom: 0,
            ..Default::default()
        };

        split_tile(features, &mut tiles, &mut sources, &options, 0, 0, 0, None);
        assert_eq!(tiles.len(), 1);
        assert!(sources.contains_key(&tile_key(0, 0, 0)));

        // Drill down from z0 to z3/4/3 (where lon=0,lat=0 lives)
        // project_x(0) = 0.5 -> z1: x=1, z2: x=2, z3: x=4
        // project_y(0) = 0.5 -> z1: y=0, z2: y=1, z3: y=3 (Mercator y inverted)
        let source = sources.remove(&tile_key(0, 0, 0)).unwrap();
        split_tile(
            source,
            &mut tiles,
            &mut sources,
            &options,
            0,
            0,
            0,
            Some((3, 4, 3)),
        );

        // Target tile should exist with the point feature
        let target_key = tile_key(4, 3, 3);
        assert!(
            tiles.contains_key(&target_key),
            "Target tile z3/4/3 should be generated by drill-down"
        );
        assert_eq!(tiles[&target_key].features.len(), 1);

        // Intermediate ancestor tiles should also exist
        assert!(tiles.contains_key(&tile_key(1, 0, 1)));
        assert!(tiles.contains_key(&tile_key(2, 1, 2)));
    }

    #[test]
    fn test_drill_down_skips_non_ancestor_tiles() {
        // Two points in different quadrants at z1:
        // lon=0, lat=0  -> project_x=0.5, project_y=0.5 -> z1: x=1, y=1
        // lon=-90,lat=45 -> project_x=0.25, project_y≈0.36 -> z1: x=0, y=0
        let geojson: GeoJson = serde_json::from_str(
            r#"{
                "type": "MultiPoint",
                "coordinates": [[0, 0], [-90, 45]]
            }"#,
        )
        .unwrap();

        let features = arc_features(&geojson);
        let mut tiles = FxHashMap::default();
        let mut sources = FxHashMap::default();
        let options = Options {
            index_max_zoom: 0,
            ..Default::default()
        };

        split_tile(features, &mut tiles, &mut sources, &options, 0, 0, 0, None);
        let source = sources.remove(&tile_key(0, 0, 0)).unwrap();

        // Target z2/2/2: ancestor path is z0/0/0 -> z1/1/1 -> z2/2/2
        // z1/0/0 (contains the -90,45 point) is NOT an ancestor of z2/2/2
        split_tile(
            source,
            &mut tiles,
            &mut sources,
            &options,
            0,
            0,
            0,
            Some((2, 2, 2)),
        );

        // Target tile should exist
        assert!(
            tiles.contains_key(&tile_key(2, 2, 2)),
            "Target tile z2/2/2 should be generated"
        );

        // z1/0/0 is NOT an ancestor of z2/2/2, so it should stop and keep its source
        let non_ancestor = tile_key(0, 0, 1); // z1, x=0, y=0
        if tiles.contains_key(&non_ancestor) {
            assert!(
                sources.contains_key(&non_ancestor),
                "Non-ancestor z1/0/0 should retain source for future drill-down"
            );
            // And no z2 children should exist under it
            let has_z2_child = tiles
                .values()
                .any(|t| t.z == 2 && (t.x == 0 || t.x == 1) && (t.y == 0 || t.y == 1));
            assert!(
                !has_z2_child,
                "Non-ancestor branch should not produce z2 children"
            );
        }
    }

    #[test]
    fn test_reaches_max_zoom() {
        let geojson: GeoJson =
            serde_json::from_str(r#"{"type": "Point", "coordinates": [0, 0]}"#).unwrap();

        let features = arc_features(&geojson);
        let mut tiles = FxHashMap::default();
        let mut sources = FxHashMap::default();
        let options = Options {
            index_max_zoom: 3,
            index_max_points: 0, // Force splitting to max zoom
            ..Default::default()
        };

        split_tile(features, &mut tiles, &mut sources, &options, 0, 0, 0, None);

        // Should have tiles at zoom level 3
        let has_z3 = tiles.values().any(|t| t.z == 3);
        assert!(has_z3, "Should have tiles at zoom level 3");
    }
}
