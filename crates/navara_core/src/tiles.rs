use crate::{Extent, Float, LngLat, Rad, Radians};
use navara_math::{FloatType, Two};
use regex::Regex;

#[derive(Debug, Copy, Clone, PartialEq, Eq)]
pub struct TileXY {
    pub x: usize,
    pub y: usize,
}

impl From<TileXYZ> for TileXY {
    fn from(xyz: TileXYZ) -> Self {
        Self { x: xyz.x, y: xyz.y }
    }
}

impl TileXY {
    pub fn to_xyz(self, z: usize) -> TileXYZ {
        TileXYZ {
            x: self.x,
            y: self.y,
            z,
        }
    }
}

#[derive(Debug, Copy, Clone, Default, PartialEq, Eq)]
pub struct TileXYZ {
    pub x: usize,
    pub y: usize,
    pub z: usize,
}

#[derive(Debug)]
pub enum TileRegion {
    NorthWest,
    NorthEast,
    SouthEast,
    SouthWest,
}

impl TileXYZ {
    /// Returns the number of tiles in the x and y direction at this zoom level.
    pub fn n(self) -> usize {
        2_usize.pow(self.z as u32)
    }

    /// Returns the normalized world position of the north-west corner of the tile.
    pub fn north_west_world_pos(self) -> (FloatType, FloatType) {
        let n = self.n() as FloatType;
        (self.x as FloatType / n, self.y as FloatType / n)
    }

    /// Returns the normalized world position of the north-east corner of the tile.
    pub fn extent(self) -> Extent<FloatType, Radians> {
        let e1 = self.north_west_world_pos();
        let e2 = (TileXYZ {
            x: self.x + 1,
            y: self.y + 1,
            z: self.z,
        })
        .north_west_world_pos();

        let p1 = web_mercator_world_pos_to_lnglat(e1.0, e1.1);
        let p2 = web_mercator_world_pos_to_lnglat(e2.0, e2.1);
        Extent::from_points(&[p1, p2])
    }
}

/// Converts a normalized world position in Web mercator to a longitude and latitude.
pub fn web_mercator_world_pos_to_lnglat<F: Float + Two<F>>(x: F, y: F) -> LngLat<F, Radians> {
    let pi_4 = F::PI / (F::two() * F::two());
    let lng = x * (F::two() * F::PI) - F::PI;
    let phi = F::PI - F::two() * F::PI * y; // y=0 -> PI, y=1 -> -PI
    let lat = F::two() * (phi.exp().atan() - pi_4);
    LngLat {
        lng: Rad::new(lng),
        lat: Rad::new(lat),
    }
}

/// Converts a tile Y coordinate to latitude in radians using Web Mercator projection.
///
/// # Arguments
/// * `y` - Tile Y coordinate (can be fractional, e.g., y + 0.5 for tile center)
/// * `z` - Zoom level
///
/// # Returns
/// Latitude in radians
///
/// # Note
/// This uses the identity: lat = atan(sinh(π·(1 - 2·y_normalized)))
/// which is equivalent to: lat = 2·atan(exp(π·(1 - 2·y_normalized))) - π/2
pub fn tile_y_to_latitude(y: f64, z: usize) -> f64 {
    let tile_size = (z as f64).exp2();
    let normalized_y = y / tile_size;
    let phi = std::f64::consts::PI * (1.0 - 2.0 * normalized_y);
    phi.sinh().atan()
}

/// Calculates meters per texel for a tile at given coordinates.
/// This is used for hillshade normal map generation to determine the scale of elevation changes.
///
/// # Arguments
/// * `tile_y` - Tile Y coordinate
/// * `tile_z` - Tile zoom level
/// * `texture_zoom` - Texture zoom level (may differ from tile zoom for overscaled tiles)
/// * `texture_width` - Total texture width in pixels (including padding)
/// * `ellipsoid_semi_major_axis` - Semi-major axis of the ellipsoid in meters (e.g., WGS84: 6378137.0)
///
/// # Returns
/// Meters per texel at the tile's center latitude
///
/// # Note
/// The calculation accounts for:
/// - 2-pixel padding (content width = texture_width - 2)
/// - Web Mercator distortion (using cosine of latitude)
/// - Earth's curvature (using ellipsoid circumference)
pub fn calc_meters_per_texel(
    tile_y: usize,
    tile_z: usize,
    texture_zoom: usize,
    texture_width: u32,
    ellipsoid_semi_major_axis: f64,
) -> f32 {
    // Calculate latitude at tile center and get its cosine for Web Mercator correction
    let cos_lat = tile_y_to_latitude(tile_y as f64 + 0.5, tile_z).cos();
    let earth_circumference = 2.0 * std::f64::consts::PI * ellipsoid_semi_major_axis;
    let content_pixel_width = texture_width.saturating_sub(2).max(1) as f64;
    let meters_per_texel =
        (earth_circumference * cos_lat) / (content_pixel_width * (1u64 << texture_zoom) as f64);
    meters_per_texel as f32
}

pub fn tile_url(s: &str, xyz: &TileXYZ, tms: bool) -> String {
    let y = if tms {
        2usize.pow(xyz.z as u32) - 1 - xyz.y
    } else {
        xyz.y
    };
    s.replace("{x}", &xyz.x.to_string())
        .replace("{y}", &y.to_string())
        .replace("{z}", &xyz.z.to_string())
}

pub fn is_tile_url(s: &str) -> bool {
    s.contains("/{x}") && s.contains("/{y}") && s.contains("/{z}")
}

// Ref: https://github.com/mapbox/vector-tile-spec/tree/master/2.1#3-projection-and-bounds
// The function get_tile_pos_from_url is designed to parse the values of x, y, and z
// from the end of a URL in the format .../z/x/y.mvt
pub fn get_tile_pos_from_url(url: &str) -> Option<TileXYZ> {
    // Define a regular expression to match the three numbers in the URL
    let re = Regex::new(r"/(\d+)/(\d+)/(\d+)\.(mvt|pbf)$").unwrap();

    if let Some(captures) = re.captures(url) {
        // Parse and assign the three values to z, x, and y respectively
        let z: usize = captures[1].parse().ok()?;
        let x: usize = captures[2].parse().ok()?;
        let y: usize = captures[3].parse().ok()?;

        // Return (x, y, z)
        Some(TileXYZ { x, y, z })
    } else {
        None
    }
}

#[derive(Debug, Copy, Clone, PartialEq)]
pub struct TileXYZIterator {
    z: usize,
    x: usize,
    y: usize,
    n: usize,
}

impl Iterator for TileXYZIterator {
    type Item = TileXYZ;

    fn next(&mut self) -> Option<Self::Item> {
        if self.y < self.n {
            let result = Some(TileXYZ {
                x: self.x,
                y: self.y,
                z: self.z,
            });
            self.x += 1;
            if self.x == self.n {
                self.x = 0;
                self.y += 1;
            }
            result
        } else {
            None
        }
    }
}

pub fn iter_tiles(z: usize) -> TileXYZIterator {
    let n = 2_usize.pow(z as u32);
    TileXYZIterator { z, x: 0, y: 0, n }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_web_mercator_world_pos_to_west_north() {
        let p = web_mercator_world_pos_to_lnglat(0.5, 0.5);
        assert_eq!(p.lng, Rad::new(0.0));
        assert_eq!(p.lat, Rad::new(0.0));
    }

    #[test]
    fn test_tile_y_to_latitude() {
        // Test at equator (tile center at y=0.5 at z=0 should give lat=0)
        let lat = tile_y_to_latitude(0.5, 0);
        assert!((lat - 0.0).abs() < 1e-10, "Equator should have latitude 0");

        // Test at zoom 1, center of tile (0, 0) should be north of equator
        let lat_north = tile_y_to_latitude(0.5, 1);
        assert!(lat_north > 0.0, "North tile should have positive latitude");

        // Test at zoom 1, center of tile (0, 1) should be south of equator
        let lat_south = tile_y_to_latitude(1.5, 1);
        assert!(lat_south < 0.0, "South tile should have negative latitude");

        // Test symmetry: tiles equidistant from equator should have opposite latitudes
        assert!(
            (lat_north + lat_south).abs() < 1e-10,
            "Latitudes should be symmetric around equator"
        );
    }

    #[test]
    fn test_tile_extent() {
        const PI: FloatType = std::f64::consts::PI;
        let max_lat = 2.0 * (((PI - 2.0 * PI * 0.0).exp().atan()) - PI / 4.0);
        let min_lat = 2.0 * (((PI - 2.0 * PI * 1.0).exp().atan()) - PI / 4.0);

        let xyz = TileXYZ { x: 0, y: 0, z: 0 };
        let extent = xyz.extent();
        assert_eq!(extent.west, Rad::new(-PI), "west");
        assert_eq!(extent.east, Rad::new(PI), "east");
        assert_eq!(extent.north, Rad::new(max_lat), "north");
        assert_eq!(extent.south, Rad::new(min_lat), "south");
    }

    #[test]
    fn test_tile_xyz_iterator() {
        let mut iter = iter_tiles(0);
        assert_eq!(iter.next(), Some(TileXYZ { x: 0, y: 0, z: 0 }));
        assert_eq!(iter.next(), None);

        let mut iter = iter_tiles(1);
        assert_eq!(iter.next(), Some(TileXYZ { x: 0, y: 0, z: 1 }));
        assert_eq!(iter.next(), Some(TileXYZ { x: 1, y: 0, z: 1 }));
        assert_eq!(iter.next(), Some(TileXYZ { x: 0, y: 1, z: 1 }));
        assert_eq!(iter.next(), Some(TileXYZ { x: 1, y: 1, z: 1 }));
        assert_eq!(iter.next(), None);

        let mut iter = iter_tiles(2);
        assert_eq!(iter.next(), Some(TileXYZ { x: 0, y: 0, z: 2 }));
        assert_eq!(iter.next(), Some(TileXYZ { x: 1, y: 0, z: 2 }));
        assert_eq!(iter.next(), Some(TileXYZ { x: 2, y: 0, z: 2 }));
        assert_eq!(iter.next(), Some(TileXYZ { x: 3, y: 0, z: 2 }));
        assert_eq!(iter.next(), Some(TileXYZ { x: 0, y: 1, z: 2 }));
        assert_eq!(iter.next(), Some(TileXYZ { x: 1, y: 1, z: 2 }));
        assert_eq!(iter.next(), Some(TileXYZ { x: 2, y: 1, z: 2 }));
        assert_eq!(iter.next(), Some(TileXYZ { x: 3, y: 1, z: 2 }));
        assert_eq!(iter.next(), Some(TileXYZ { x: 0, y: 2, z: 2 }));
        assert_eq!(iter.next(), Some(TileXYZ { x: 1, y: 2, z: 2 }));
        assert_eq!(iter.next(), Some(TileXYZ { x: 2, y: 2, z: 2 }));
        assert_eq!(iter.next(), Some(TileXYZ { x: 3, y: 2, z: 2 }));
        assert_eq!(iter.next(), Some(TileXYZ { x: 0, y: 3, z: 2 }));
        assert_eq!(iter.next(), Some(TileXYZ { x: 1, y: 3, z: 2 }));
        assert_eq!(iter.next(), Some(TileXYZ { x: 2, y: 3, z: 2 }));
        assert_eq!(iter.next(), Some(TileXYZ { x: 3, y: 3, z: 2 }));
        assert_eq!(iter.next(), None);
    }
}
