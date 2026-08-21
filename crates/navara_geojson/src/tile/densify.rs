use navara_core::{EllipsoidGeodesic, LLE, Radians, WGS84_64};
use navara_parser::geojson::{
    Feature, FeatureCollection, GeoJson, Geometry, GeometryValue, Position,
};

/// Densifies LineString segments and Polygon ring edges along the
/// ellipsoidal geodesic before mercator tiling.
///
/// The tiled (clamp-to-ground) pipeline treats segments as straight lines in
/// Web Mercator space, which follow rhumb-like paths on the globe. The direct
/// (non-clamped) pipeline interpolates polyline segments with
/// [`EllipsoidGeodesic`] and subdivides polygon edges toward the great
/// circle, so without densification the same geometry takes a different path
/// depending on `clampToGround`. Inserting geodesic points at the same
/// granularity as the direct path makes the mercator straight lines between
/// them indistinguishable from the geodesic.
///
/// Segments are also unwrapped in longitude (consecutive vertices kept within
/// 180° of each other, extending past ±180° when needed) so a segment
/// crossing the antimeridian takes the short way — the path the geodesic of
/// the direct pipeline takes — instead of streaking across the mercator
/// world. The tiler handles out-of-range longitudes via its world-copy wrap.
/// A closed polygon ring whose unwrap would break closure (a ring encircling
/// a pole) is kept as-is.
///
/// Returns `None` when nothing changed, so the caller can keep using the
/// original document without cloning it.
pub(crate) fn densify_geojson(geojson: &GeoJson, granularity: f64) -> Option<GeoJson> {
    match geojson {
        GeoJson::FeatureCollection(fc) => {
            let mut changed = false;
            let features = fc
                .features
                .iter()
                .map(|f| match densify_feature(f, granularity) {
                    Some(new_f) => {
                        changed = true;
                        new_f
                    }
                    None => f.clone(),
                })
                .collect();
            changed.then(|| {
                GeoJson::FeatureCollection(FeatureCollection {
                    bbox: fc.bbox.clone(),
                    features,
                    foreign_members: fc.foreign_members.clone(),
                })
            })
        }
        GeoJson::Feature(f) => densify_feature(f, granularity).map(GeoJson::Feature),
        GeoJson::Geometry(g) => densify_geometry(g, granularity).map(GeoJson::Geometry),
    }
}

fn densify_feature(feature: &Feature, granularity: f64) -> Option<Feature> {
    let geometry = densify_geometry(feature.geometry.as_ref()?, granularity)?;
    Some(Feature {
        bbox: feature.bbox.clone(),
        geometry: Some(geometry),
        id: feature.id.clone(),
        properties: feature.properties.clone(),
        foreign_members: feature.foreign_members.clone(),
    })
}

fn densify_geometry(geometry: &Geometry, granularity: f64) -> Option<Geometry> {
    let value = match &geometry.value {
        GeometryValue::LineString { coordinates } => GeometryValue::LineString {
            coordinates: densify_line(coordinates, granularity)?,
        },
        GeometryValue::MultiLineString { coordinates } => {
            let mut changed = false;
            let lines = coordinates
                .iter()
                .map(|line| match densify_line(line, granularity) {
                    Some(new_line) => {
                        changed = true;
                        new_line
                    }
                    None => line.clone(),
                })
                .collect();
            if !changed {
                return None;
            }
            GeometryValue::MultiLineString { coordinates: lines }
        }
        GeometryValue::Polygon { coordinates } => {
            let mut changed = false;
            let rings = densify_rings(coordinates, granularity, &mut changed);
            if !changed {
                return None;
            }
            GeometryValue::Polygon { coordinates: rings }
        }
        GeometryValue::MultiPolygon { coordinates } => {
            let mut changed = false;
            let polygons = coordinates
                .iter()
                .map(|rings| densify_rings(rings, granularity, &mut changed))
                .collect();
            if !changed {
                return None;
            }
            GeometryValue::MultiPolygon {
                coordinates: polygons,
            }
        }
        GeometryValue::GeometryCollection { geometries } => {
            let mut changed = false;
            let geoms = geometries
                .iter()
                .map(|g| match densify_geometry(g, granularity) {
                    Some(new_g) => {
                        changed = true;
                        new_g
                    }
                    None => g.clone(),
                })
                .collect();
            if !changed {
                return None;
            }
            GeometryValue::GeometryCollection { geometries: geoms }
        }
        _ => return None,
    };
    Some(Geometry {
        bbox: geometry.bbox.clone(),
        value,
        foreign_members: geometry.foreign_members.clone(),
    })
}

fn densify_rings(
    rings: &[Vec<Position>],
    granularity: f64,
    changed: &mut bool,
) -> Vec<Vec<Position>> {
    rings
        .iter()
        .map(|ring| match densify_ring(ring, granularity) {
            Some(new_ring) => {
                *changed = true;
                new_ring
            }
            None => ring.clone(),
        })
        .collect()
}

fn densify_ring(ring: &[Position], granularity: f64) -> Option<Vec<Position>> {
    let out = densify_line(ring, granularity)?;

    // Unwrapping a ring that encircles a pole shifts its closing vertex by a
    // full revolution, breaking closure — keep such rings untouched.
    let was_closed = matches!(
        (ring.first(), ring.last()),
        (Some(first), Some(last))
            if first.len() >= 2 && last.len() >= 2
                && first[0] == last[0] && first[1] == last[1]
    );
    if was_closed {
        let (first, last) = (out.first()?, out.last()?);
        if first[0] != last[0] {
            return None;
        }
    }

    Some(out)
}

fn densify_line(coords: &[Position], granularity: f64) -> Option<Vec<Position>> {
    if coords.len() < 2 || granularity <= 0. {
        return None;
    }

    let ellipsoid = WGS84_64;
    let mut out: Vec<Position> = Vec::with_capacity(coords.len());
    let mut changed = false;
    // Unwrapped lng/lat (degrees) of the last emitted original vertex.
    let mut prev: Option<(f64, f64)> = None;

    for p in coords {
        if p.len() < 2 {
            // Malformed vertex: keep verbatim and restart continuity after it.
            out.push(p.clone());
            prev = None;
            continue;
        }
        let (lng_raw, lat) = (p[0], p[1]);
        let Some((prev_lng, prev_lat)) = prev else {
            out.push(p.clone());
            prev = Some((lng_raw, lat));
            continue;
        };

        let mut lng = lng_raw;
        while lng - prev_lng > 180. {
            lng -= 360.;
        }
        while lng - prev_lng < -180. {
            lng += 360.;
        }

        let start =
            LLE::<f64, Radians>::from_float(prev_lng.to_radians(), prev_lat.to_radians(), 0.);
        let end = LLE::<f64, Radians>::from_float(lng.to_radians(), lat.to_radians(), 0.);
        let line = EllipsoidGeodesic::new(start, end, &ellipsoid);
        let distance = line.distance;
        // Vincenty's iteration is bounded in EllipsoidGeodesic (near-antipodal
        // endpoints yield a finite estimate); the finite check guards NaN
        // input coordinates, which keep the segment as-is.
        if distance.is_finite() && distance >= granularity {
            let segments = (distance / granularity).ceil() as usize;
            let step = distance / segments as f64;
            let mut interp_prev_lng = prev_lng;
            for k in 1..segments {
                let c = line.interpolate_distance(&ellipsoid, step * k as f64);
                let mut interp_lng = c.lng.val().to_degrees();
                let interp_lat = c.lat.val().to_degrees();
                while interp_lng - interp_prev_lng > 180. {
                    interp_lng -= 360.;
                }
                while interp_lng - interp_prev_lng < -180. {
                    interp_lng += 360.;
                }
                out.push(Position::from([interp_lng, interp_lat]));
                interp_prev_lng = interp_lng;
                changed = true;
            }
        }

        if lng != lng_raw {
            changed = true;
        }
        let mut vertex = p.clone();
        vertex[0] = lng;
        out.push(vertex);
        prev = Some((lng, lat));
    }

    changed.then_some(out)
}

#[cfg(test)]
mod test {
    use super::*;

    fn line_geojson(coords: Vec<[f64; 2]>) -> GeoJson {
        GeoJson::Geometry(Geometry {
            bbox: None,
            value: GeometryValue::LineString {
                coordinates: coords.into_iter().map(Position::from).collect(),
            },
            foreign_members: None,
        })
    }

    fn line_coords(geojson: &GeoJson) -> &[Position] {
        match geojson {
            GeoJson::Geometry(Geometry {
                value: GeometryValue::LineString { coordinates },
                ..
            }) => coordinates,
            _ => panic!("expected LineString geometry"),
        }
    }

    #[test]
    fn short_segments_are_left_untouched() {
        let geojson = line_geojson(vec![[139.7, 35.7], [139.71, 35.71]]);
        assert!(densify_geojson(&geojson, 9999.).is_none());
    }

    #[test]
    fn long_segment_follows_the_geodesic() {
        // Tokyo -> San Francisco: the great circle arcs far north of the
        // rhumb line, so interpolated latitudes must exceed both endpoints.
        let geojson = line_geojson(vec![[139.7, 35.7], [-122.4, 37.8]]);
        let densified = densify_geojson(&geojson, 9999.).expect("must densify");
        let coords = line_coords(&densified);
        // ~8300km geodesic at ~10km steps.
        assert!(coords.len() > 500, "got {} points", coords.len());
        let max_lat = coords
            .iter()
            .map(|p| p[1])
            .fold(f64::NEG_INFINITY, f64::max);
        assert!(max_lat > 45., "geodesic must arc north, got {max_lat}");
    }

    #[test]
    fn antimeridian_segment_is_unwrapped_to_the_short_way() {
        let geojson = line_geojson(vec![[170., 10.], [-170., 10.]]);
        let densified = densify_geojson(&geojson, 9999.).expect("must densify");
        let coords = line_coords(&densified);
        // The end vertex is unwrapped past +180 and every consecutive pair
        // stays within 180 degrees, so the mercator tiler never streaks the
        // segment across the world.
        assert_eq!(coords.last().unwrap()[0], 190.);
        for pair in coords.windows(2) {
            assert!((pair[1][0] - pair[0][0]).abs() < 180.);
        }
    }

    #[test]
    fn multilinestring_and_collections_recurse() {
        let geojson = GeoJson::Geometry(Geometry {
            bbox: None,
            value: GeometryValue::MultiLineString {
                coordinates: vec![
                    vec![Position::from([0., 0.]), Position::from([10., 0.])],
                    vec![Position::from([0., 0.]), Position::from([0.01, 0.])],
                ],
            },
            foreign_members: None,
        });
        let densified = densify_geojson(&geojson, 9999.).expect("must densify");
        match densified {
            GeoJson::Geometry(Geometry {
                value: GeometryValue::MultiLineString { coordinates },
                ..
            }) => {
                assert!(coordinates[0].len() > 100);
                assert_eq!(coordinates[1].len(), 2);
            }
            _ => panic!("expected MultiLineString geometry"),
        }
    }

    fn polygon_geojson(rings: Vec<Vec<[f64; 2]>>) -> GeoJson {
        GeoJson::Geometry(Geometry {
            bbox: None,
            value: GeometryValue::Polygon {
                coordinates: rings
                    .into_iter()
                    .map(|ring| ring.into_iter().map(Position::from).collect())
                    .collect(),
            },
            foreign_members: None,
        })
    }

    fn polygon_rings(geojson: &GeoJson) -> &[Vec<Position>] {
        match geojson {
            GeoJson::Geometry(Geometry {
                value: GeometryValue::Polygon { coordinates },
                ..
            }) => coordinates,
            _ => panic!("expected Polygon geometry"),
        }
    }

    #[test]
    fn polygon_rings_are_densified_and_stay_closed() {
        let geojson = polygon_geojson(vec![vec![
            [0., 0.],
            [50., 0.],
            [50., 50.],
            [0., 50.],
            [0., 0.],
        ]]);
        let densified = densify_geojson(&geojson, 9999.).expect("must densify");
        let ring = &polygon_rings(&densified)[0];
        assert!(ring.len() > 100, "got {} points", ring.len());
        assert_eq!(ring.first().unwrap()[0], ring.last().unwrap()[0]);
        assert_eq!(ring.first().unwrap()[1], ring.last().unwrap()[1]);
    }

    #[test]
    fn pole_encircling_ring_is_kept_untouched() {
        // Unwrapping this ring would move the closing vertex to lng=360 and
        // break closure, so the ring must be left as-is.
        let geojson = polygon_geojson(vec![vec![[0., 80.], [120., 80.], [-120., 80.], [0., 80.]]]);
        assert!(densify_geojson(&geojson, 9999.).is_none());
    }
}
