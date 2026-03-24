pub(crate) mod clip;
pub(crate) mod convert;
pub(crate) mod simplify;
pub(crate) mod split;
pub(crate) mod tile;
pub mod types;
pub(crate) mod wrap;

use std::sync::Arc;

use geojson_lib::GeoJson;
use navara_quadtree::{QuadLeafHandle, decode_quadleaf_handle, encode_quadleaf_handle};
use rustc_hash::FxHashMap;

use crate::convert::convert;
use crate::split::{split_tile, tile_key};
use crate::types::Tile;
use crate::wrap::wrap;

/// Options for GeoJSON indexing.
#[derive(Debug, Clone)]
pub struct Options {
    /// Maximum zoom level to preserve detail on. Affects simplification tolerance.
    pub max_zoom: u32,
    /// Maximum zoom level for pre-indexing. Tiles beyond this are generated on demand.
    pub index_max_zoom: u32,
    /// Maximum number of points per tile before further splitting stops.
    pub index_max_points: u32,
    /// Tile extent in tile coordinate units.
    pub extent: u32,
    /// Buffer around each tile in tile coordinate units.
    pub buffer: u32,
    /// Simplification tolerance.
    pub tolerance: f64,
}

impl Default for Options {
    fn default() -> Self {
        Self {
            max_zoom: 14,
            index_max_zoom: 5,
            index_max_points: 100_000,
            extent: 4096,
            buffer: 64,
            tolerance: 3.0,
        }
    }
}

/// A spatial index for GeoJSON features, organized into XYZ tiles.
///
/// Pre-indexes features up to `index_max_zoom` and generates tiles
/// on demand for higher zoom levels.
pub struct GeoJsonVt {
    tiles: FxHashMap<navara_quadtree::QuadLeafHandle, Tile>,
    /// Source features stored at leaf tiles for on-demand drill-down.
    sources: FxHashMap<navara_quadtree::QuadLeafHandle, Vec<Arc<types::InternalFeature>>>,
    options: Options,
}

pub type TileKey = QuadLeafHandle;

impl GeoJsonVt {
    /// Creates a new index from a GeoJSON document.
    pub fn new(geojson: &GeoJson, options: Options) -> Self {
        let buffer_ratio = (options.buffer as f64) / (options.extent as f64);

        // Compute simplification tolerance for the convert phase
        let z2_max = (1u64 << options.max_zoom) as f64;
        let sq_tolerance = (options.tolerance / (z2_max * options.extent as f64)).powi(2);

        // Convert GeoJSON features to internal representation (with simplification)
        let features = convert(geojson, sq_tolerance);
        let features: Vec<Arc<types::InternalFeature>> =
            features.into_iter().map(Arc::new).collect();

        // Handle antimeridian wrapping
        let features = wrap(&features, buffer_ratio);

        // Split features into tiles up to index_max_zoom
        let mut tiles = FxHashMap::default();
        let mut sources = FxHashMap::default();
        split_tile(features, &mut tiles, &mut sources, &options, 0, 0, 0, None);

        Self {
            tiles,
            sources,
            options,
        }
    }

    /// Encodes tile coordinates into a [`TileKey`].
    /// Returns `None` if coordinates are out of range.
    pub fn key(&self, z: u32, x: u32, y: u32) -> Option<TileKey> {
        encode_quadleaf_handle((x, y, z))
    }

    /// Retrieves a tile at the given coordinates.
    ///
    /// For zoom levels up to `index_max_zoom`, returns the pre-indexed tile.
    /// For higher zoom levels, drills down from the nearest ancestor tile
    /// that has stored source features.
    pub fn get_tile(&mut self, z: u32, x: u32, y: u32) -> Option<&Tile> {
        let key = self.key(z, x, y)?;

        // If tile already exists, return it
        if self.tiles.contains_key(&key) {
            return self.tiles.get(&key);
        }

        // Walk up to find the nearest ancestor with source features
        let mut z0 = z;
        let mut x0 = x;
        let mut y0 = y;
        let mut parent_key = None;

        while z0 > 0 {
            z0 -= 1;
            x0 >>= 1;
            y0 >>= 1;
            let ancestor_key = tile_key(x0, y0, z0);
            if self.sources.contains_key(&ancestor_key) {
                parent_key = Some(ancestor_key);
                break;
            }
        }

        let parent_key = parent_key?;
        let is_pre_indexed = z0 <= self.options.index_max_zoom;
        let source = self.sources.remove(&parent_key)?;

        // Drill down from the ancestor to the target tile
        split_tile(
            source.clone(),
            &mut self.tiles,
            &mut self.sources,
            &self.options,
            z0,
            x0,
            y0,
            Some((z, x, y)),
        );

        // Restore pre-indexed source so evict+re-drill works.
        // split_tile removes the starting source during drilling, but
        // pre-indexed sources must survive for future drill-down regeneration.
        if is_pre_indexed {
            self.sources.insert(parent_key, source);
        }

        self.tiles.get(&key)
    }

    /// Checks if a tile exists at the given coordinates.
    ///
    /// Includes both pre-indexed and drill-down-generated tiles.
    /// Does not trigger on-demand generation.
    pub fn has_tile(&self, z: u32, x: u32, y: u32) -> bool {
        self.key(z, x, y)
            .is_some_and(|k| self.tiles.contains_key(&k))
    }

    pub fn within(&self, z: u32) -> bool {
        z <= self.options.max_zoom
    }

    /// Returns the total number of tiles, including any drill-down tiles
    /// generated by previous `get_tile` calls.
    pub fn tile_count(&self) -> usize {
        self.tiles.len()
    }

    /// Returns an iterator over all tiles, including any drill-down tiles
    /// generated by previous `get_tile` calls.
    pub fn tiles(&self) -> impl Iterator<Item = &Tile> {
        self.tiles.values()
    }

    /// Removes a drill-down tile from the cache.
    ///
    /// Only removes tiles beyond `index_max_zoom`. Pre-indexed tiles
    /// are never removed — they're needed for drill-down regeneration.
    /// Returns `true` if anything was removed.
    pub fn remove_tile(&mut self, key: TileKey) -> bool {
        let (_, _, z): (u32, u32, u32) = decode_quadleaf_handle(key);
        if z <= self.options.index_max_zoom {
            return false;
        }
        let a = self.tiles.remove(&key).is_some();
        let b = self.sources.remove(&key).is_some();
        a || b
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_feature_collection() -> GeoJson {
        serde_json::from_str(
            r#"{
                "type": "FeatureCollection",
                "features": [
                    {
                        "type": "Feature",
                        "geometry": {
                            "type": "Polygon",
                            "coordinates": [
                                [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]
                            ]
                        },
                        "properties": {"name": "square"}
                    }
                ]
            }"#,
        )
        .unwrap()
    }

    #[test]
    fn test_new_and_get_tile_z0() {
        let geojson = sample_feature_collection();
        let mut vt = GeoJsonVt::new(&geojson, Options::default());

        // The polygon is near the center, z=0 should contain it
        let tile = vt.get_tile(0, 0, 0);
        assert!(tile.is_some());
        let tile = tile.unwrap();
        assert_eq!(tile.z, 0);
        assert_eq!(tile.x, 0);
        assert_eq!(tile.y, 0);
        assert!(!tile.features.is_empty());
    }

    #[test]
    fn test_overscaling() {
        let geojson = sample_feature_collection();
        let opts = Options {
            index_max_zoom: 2,
            ..Default::default()
        };
        let mut vt = GeoJsonVt::new(&geojson, opts);

        // Tile at z=4, x=15, y=15 covers the far SE corner of the world,
        // well outside the polygon near (0,0)-(10,10).
        let tile = vt.get_tile(4, 15, 15);
        assert!(tile.is_none());
    }

    #[test]
    fn test_empty_tile() {
        let geojson = sample_feature_collection();
        let mut vt = GeoJsonVt::new(&geojson, Options::default());

        // Far away tile should be empty/None
        let tile = vt.get_tile(5, 31, 31);
        assert!(tile.is_none());
    }

    #[test]
    fn test_property_sharing() {
        let geojson = sample_feature_collection();
        let mut vt = GeoJsonVt::new(&geojson, Options::default());

        let tile = vt.get_tile(0, 0, 0).unwrap();
        assert_eq!(
            tile.features[0].properties["name"],
            serde_json::json!("square")
        );
    }

    #[test]
    fn test_multiple_features() {
        let geojson: GeoJson = serde_json::from_str(
            r#"{
                "type": "FeatureCollection",
                "features": [
                    {
                        "type": "Feature",
                        "geometry": {"type": "Point", "coordinates": [0, 0]},
                        "properties": {"id": 1}
                    },
                    {
                        "type": "Feature",
                        "geometry": {"type": "Point", "coordinates": [90, 45]},
                        "properties": {"id": 2}
                    }
                ]
            }"#,
        )
        .unwrap();

        let mut vt = GeoJsonVt::new(&geojson, Options::default());
        let tile = vt.get_tile(0, 0, 0);
        assert!(tile.is_some());
        let tile = tile.unwrap();
        assert_eq!(tile.features.len(), 2);
    }

    #[test]
    fn test_remove_tile_drill_down() {
        let geojson = sample_feature_collection();
        let opts = Options {
            index_max_zoom: 2,
            ..Default::default()
        };
        let mut vt = GeoJsonVt::new(&geojson, opts);

        // Polygon at (0,0)-(10,10) projects to ~x:[0.5,0.528] y:[0.472,0.5].
        // At z=3 that falls in tile (4, 3).
        let tile = vt.get_tile(3, 4, 3);
        assert!(tile.is_some());

        // Remove the drill-down tile
        let key = vt.key(3, 4, 3).unwrap();
        assert!(vt.remove_tile(key));

        // Tile should be gone now
        assert!(!vt.has_tile(3, 4, 3));

        // But we can regenerate it via get_tile
        let tile = vt.get_tile(3, 4, 3);
        assert!(tile.is_some());
    }

    #[test]
    fn test_remove_tile_pre_indexed_refused() {
        let geojson = sample_feature_collection();
        let opts = Options {
            index_max_zoom: 2,
            ..Default::default()
        };
        let mut vt = GeoJsonVt::new(&geojson, opts);

        // Pre-indexed tile at z=0 should not be removable
        let key = vt.key(0, 0, 0).unwrap();
        assert!(!vt.remove_tile(key));

        // Tile should still exist
        assert!(vt.has_tile(0, 0, 0));
    }

    #[test]
    fn test_evict_and_redrill() {
        let geojson = sample_feature_collection();
        let opts = Options {
            index_max_zoom: 2,
            ..Default::default()
        };
        let mut vt = GeoJsonVt::new(&geojson, opts);

        // Drill down to z=3 tile (4, 3) beyond index_max_zoom=2
        let original_count = vt.get_tile(3, 4, 3).unwrap().features.len();

        // Evict the drill-down tile
        let key = vt.key(3, 4, 3).unwrap();
        vt.remove_tile(key);

        // Re-drill and verify same result
        let tile = vt.get_tile(3, 4, 3);
        assert!(tile.is_some());
        assert_eq!(tile.unwrap().features.len(), original_count);
    }
}
