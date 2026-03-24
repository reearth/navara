use std::sync::Arc;

use crate::Options;
use crate::types::{InternalFeature, InternalGeometry, Ring, Tile, TileFeature, TileGeometry};

/// Creates an output Tile from internal features.
///
/// 1. Computes per-zoom simplification tolerance
/// 2. Filters points by z-coord importance > sqTolerance
/// 3. Skips small geometries (area/dist < threshold)
/// 4. Transforms coordinates to tile-local extent space
/// 5. Rewinds polygon rings for correct winding order
pub fn create_tile(
    features: &[Arc<InternalFeature>],
    z: u32,
    x: u32,
    y: u32,
    options: &Options,
) -> Tile {
    let tolerance = if z == options.max_zoom {
        0.0
    } else {
        options.tolerance / ((1u64 << z) as f64 * options.extent as f64)
    };
    let sq_tolerance = tolerance * tolerance;

    let z2 = (1u32 << z) as f64;
    let tile_x = x as f64;
    let tile_y = y as f64;
    let extent = options.extent as f64;

    let mut num_points: u32 = 0;
    let mut num_simplified: u32 = 0;

    let mut tile_features = Vec::with_capacity(features.len());
    for f in features {
        if let Some(geom) = transform_geometry(
            &f.geometry,
            z2,
            tile_x,
            tile_y,
            extent,
            tolerance,
            sq_tolerance,
            &mut num_points,
            &mut num_simplified,
        ) {
            tile_features.push(TileFeature {
                geometry: geom,
                properties: f.properties.clone(),
            });
        }
    }

    Tile {
        features: tile_features,
        z,
        x,
        y,
        num_points,
        num_simplified,
    }
}

#[allow(clippy::too_many_arguments)]
fn transform_geometry(
    geometry: &InternalGeometry,
    z2: f64,
    tile_x: f64,
    tile_y: f64,
    extent: f64,
    tolerance: f64,
    sq_tolerance: f64,
    num_points: &mut u32,
    num_simplified: &mut u32,
) -> Option<TileGeometry> {
    match geometry {
        InternalGeometry::Point(coords) => {
            let p = transform_point(coords[0], coords[1], z2, tile_x, tile_y, extent);
            *num_points += 1;
            *num_simplified += 1;
            Some(TileGeometry::Points(vec![p]))
        }
        InternalGeometry::MultiPoint(coords) => {
            let n = coords.len() / 3;
            let mut points = Vec::with_capacity(n);
            for i in 0..n {
                points.push(transform_point(
                    coords[i * 3],
                    coords[i * 3 + 1],
                    z2,
                    tile_x,
                    tile_y,
                    extent,
                ));
                *num_points += 1;
                *num_simplified += 1;
            }
            if points.is_empty() {
                None
            } else {
                Some(TileGeometry::Points(points))
            }
        }
        InternalGeometry::LineString(ring) => {
            let mut lines: Vec<Vec<[f64; 2]>> = Vec::with_capacity(1);
            add_line(
                &mut lines,
                ring,
                z2,
                tile_x,
                tile_y,
                extent,
                tolerance,
                sq_tolerance,
                false,
                false,
                num_points,
                num_simplified,
            );
            if lines.is_empty() {
                None
            } else {
                Some(TileGeometry::Lines(lines))
            }
        }
        InternalGeometry::MultiLineString(rings) => {
            let mut lines: Vec<Vec<[f64; 2]>> = Vec::with_capacity(rings.len());
            for ring in rings {
                add_line(
                    &mut lines,
                    ring,
                    z2,
                    tile_x,
                    tile_y,
                    extent,
                    tolerance,
                    sq_tolerance,
                    false,
                    false,
                    num_points,
                    num_simplified,
                );
            }
            if lines.is_empty() {
                None
            } else {
                Some(TileGeometry::Lines(lines))
            }
        }
        InternalGeometry::Polygon(rings) => {
            let mut polygon_rings: Vec<Vec<[f64; 2]>> = Vec::with_capacity(rings.len());
            for (i, ring) in rings.iter().enumerate() {
                add_line(
                    &mut polygon_rings,
                    ring,
                    z2,
                    tile_x,
                    tile_y,
                    extent,
                    tolerance,
                    sq_tolerance,
                    true,
                    i == 0,
                    num_points,
                    num_simplified,
                );
            }
            if polygon_rings.is_empty() {
                None
            } else {
                Some(TileGeometry::Polygons(vec![polygon_rings]))
            }
        }
        InternalGeometry::MultiPolygon(polygons) => {
            let mut all_rings: Vec<Vec<[f64; 2]>> =
                Vec::with_capacity(polygons.iter().map(|p| p.len()).sum::<usize>());
            for rings in polygons {
                for (i, ring) in rings.iter().enumerate() {
                    add_line(
                        &mut all_rings,
                        ring,
                        z2,
                        tile_x,
                        tile_y,
                        extent,
                        tolerance,
                        sq_tolerance,
                        true,
                        i == 0,
                        num_points,
                        num_simplified,
                    );
                }
            }
            if all_rings.is_empty() {
                None
            } else {
                Some(TileGeometry::Polygons(vec![all_rings]))
            }
        }
    }
}

/// Filters points by simplification importance, skips small geometries,
/// rewinds polygon rings, and transforms to tile space.
#[allow(clippy::too_many_arguments)]
fn add_line(
    result: &mut Vec<Vec<[f64; 2]>>,
    ring: &Ring,
    z2: f64,
    tile_x: f64,
    tile_y: f64,
    extent: f64,
    tolerance: f64,
    sq_tolerance: f64,
    is_polygon: bool,
    is_outer: bool,
    num_points: &mut u32,
    num_simplified: &mut u32,
) {
    let n = ring.len();

    // Skip small geometries
    if tolerance > 0.0 && (ring.size < if is_polygon { sq_tolerance } else { tolerance }) {
        *num_points += n as u32;
        return;
    }

    // Filter points by importance and transform to tile space
    let mut pts: Vec<[f64; 2]> = Vec::with_capacity(n);
    for i in 0..n {
        let z_importance = ring.coords[i * 3 + 2];
        if tolerance == 0.0 || z_importance > sq_tolerance {
            *num_simplified += 1;
            let x = ring.coords[i * 3];
            let y = ring.coords[i * 3 + 1];
            pts.push(transform_point(x, y, z2, tile_x, tile_y, extent));
        }
        *num_points += 1;
    }

    if is_polygon {
        rewind(&mut pts, is_outer);
    }

    result.push(pts);
}

/// Transforms a point from [0,1] space to tile-local extent space.
fn transform_point(x: f64, y: f64, z2: f64, tile_x: f64, tile_y: f64, extent: f64) -> [f64; 2] {
    [(extent * (x * z2 - tile_x)), (extent * (y * z2 - tile_y))]
}

/// Rewinds a polygon ring to ensure correct winding order.
/// Outer rings should be clockwise (area > 0), inner rings counter-clockwise.
fn rewind(ring: &mut [[f64; 2]], clockwise: bool) {
    let len = ring.len();
    if len < 2 {
        return;
    }

    // Calculate signed area using shoelace formula on 2D points
    let mut area = 0.0;
    let mut j = len - 1;
    for i in 0..len {
        area += (ring[i][0] - ring[j][0]) * (ring[i][1] + ring[j][1]);
        j = i;
    }

    // area > 0 means clockwise in screen coords
    if (area > 0.0) != clockwise {
        return; // Already correct winding
    }

    // Reverse the ring
    ring.reverse();
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Arc;

    use crate::types::BBox;

    fn default_options() -> Options {
        Options::default()
    }

    #[test]
    fn test_transform_point_z0() {
        // At z=0, the entire world is one tile
        // A point at (0.5, 0.5) should be at (2048, 2048) with extent=4096
        let p = transform_point(0.5, 0.5, 1.0, 0.0, 0.0, 4096.0);
        assert!((p[0] - 2048.0).abs() < 1e-10);
        assert!((p[1] - 2048.0).abs() < 1e-10);
    }

    #[test]
    fn test_transform_point_z1() {
        // At z=1, x=1, y=0: the tile covers x=[0.5, 1.0], y=[0.0, 0.5]
        // A point at (0.75, 0.25) should be at (2048, 2048) with extent=4096
        let p = transform_point(0.75, 0.25, 2.0, 1.0, 0.0, 4096.0);
        assert!((p[0] - 2048.0).abs() < 1e-10);
        assert!((p[1] - 2048.0).abs() < 1e-10);
    }

    #[test]
    fn test_create_tile_with_point() {
        let feature = Arc::new(InternalFeature {
            geometry: InternalGeometry::Point([0.5, 0.5, 0.0]),
            bbox: BBox {
                min_x: 0.5,
                min_y: 0.5,
                max_x: 0.5,
                max_y: 0.5,
            },
            properties: Arc::new(serde_json::json!({"name": "test"})),
            source_index: 0,
        });

        let opts = default_options();
        let tile = create_tile(&[feature], 0, 0, 0, &opts);
        assert_eq!(tile.z, 0);
        assert_eq!(tile.x, 0);
        assert_eq!(tile.y, 0);
        assert_eq!(tile.features.len(), 1);

        match &tile.features[0].geometry {
            TileGeometry::Points(pts) => {
                assert_eq!(pts.len(), 1);
                assert!((pts[0][0] - 2048.0).abs() < 1e-10);
                assert!((pts[0][1] - 2048.0).abs() < 1e-10);
            }
            _ => panic!("Expected Points geometry"),
        }

        // Properties should be preserved
        assert_eq!(
            tile.features[0].properties.as_ref(),
            &serde_json::json!({"name": "test"})
        );
    }

    #[test]
    fn test_create_tile_with_polygon() {
        // z-coords set to 1.0 so they survive simplification filtering
        let ring = Ring {
            coords: vec![
                0.0, 0.0, 1.0, 0.5, 0.0, 1.0, 0.5, 0.5, 1.0, 0.0, 0.5, 1.0, 0.0, 0.0, 1.0,
            ],
            area: 0.25,
            dist: 0.0,
            size: 0.25,
        };

        let feature = Arc::new(InternalFeature {
            geometry: InternalGeometry::Polygon(vec![ring]),
            bbox: BBox {
                min_x: 0.0,
                min_y: 0.0,
                max_x: 0.5,
                max_y: 0.5,
            },
            properties: Arc::new(serde_json::Value::Null),
            source_index: 0,
        });

        let opts = default_options();
        let tile = create_tile(&[feature], 0, 0, 0, &opts);
        assert_eq!(tile.features.len(), 1);

        match &tile.features[0].geometry {
            TileGeometry::Polygons(polygons) => {
                assert_eq!(polygons.len(), 1);
                assert_eq!(polygons[0].len(), 1); // one ring
                assert_eq!(polygons[0][0].len(), 5); // 5 points
            }
            _ => panic!("Expected Polygons geometry"),
        }
    }
}
