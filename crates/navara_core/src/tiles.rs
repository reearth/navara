use crate::{Extent, Float, LngLat, Rad, Radians};
use navara_math::{FloatType, Two};
use regex::Regex;
use serde::{Deserialize, Serialize};

/// Tiling scheme for a quadtree Globe.
///
/// `WebMercator`: single root `(0,0,0)`, tile extents use the Mercator projection.
/// `Geographic`: two roots `(0,0,0)` and `(0,1,0)`, tile extents are equal-degree
/// (EPSG:4326, 2^(z+1) columns × 2^z rows).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Default)]
pub enum TilingScheme {
    #[default]
    WebMercator,
    Geographic {
        tms: bool,
    },
}

impl TilingScheme {
    /// Root tile(s) for this scheme.
    pub fn root_tiles(&self) -> Vec<TileXYZ> {
        match self {
            TilingScheme::WebMercator => vec![TileXYZ { x: 0, y: 0, z: 0 }],
            TilingScheme::Geographic { .. } => {
                vec![TileXYZ { x: 0, y: 0, z: 0 }, TileXYZ { x: 1, y: 0, z: 0 }]
            }
        }
    }

    /// Tile extent in lng/lat radians for the given tile coordinates.
    pub fn tile_extent(&self, coords: TileXYZ) -> Extent<FloatType, Radians> {
        match self {
            TilingScheme::WebMercator => coords.extent(),
            TilingScheme::Geographic { tms } => geographic_tile_extent_direct(coords, *tms),
        }
    }

    /// Build a tile URL for a server using this tiling scheme.
    pub fn tile_url(&self, base_url: &str, coords: TileXYZ) -> String {
        match self {
            TilingScheme::WebMercator => tile_url(base_url, &coords, false),
            TilingScheme::Geographic { tms } => {
                let y = if *tms {
                    coords.y
                } else {
                    let n_y = 1usize << coords.z;
                    n_y - 1 - coords.y
                };
                base_url
                    .replace("{x}", &coords.x.to_string())
                    .replace("{y}", &y.to_string())
                    .replace("{z}", &coords.z.to_string())
            }
        }
    }

    pub fn tms(&self) -> bool {
        match self {
            TilingScheme::WebMercator => false,
            TilingScheme::Geographic { tms } => *tms,
        }
    }

    pub fn is_geographic(&self) -> bool {
        matches!(self, TilingScheme::Geographic { .. })
    }
}

/// Computes the EPSG:4326 tile extent directly from geographic tile coordinates.
/// At level z: 2^(z+1) columns × 2^z rows, each tile is (180/2^z)° square.
fn geographic_tile_extent_direct(coords: TileXYZ, tms: bool) -> Extent<FloatType, Radians> {
    let n_x = (1usize << (coords.z + 1)) as FloatType;
    let n_y = (1usize << coords.z) as FloatType;

    let west_rad = (coords.x as FloatType * 360.0 / n_x - 180.0).to_radians();
    let east_rad = ((coords.x as FloatType + 1.0) * 360.0 / n_x - 180.0).to_radians();

    let (south_rad, north_rad) = if tms {
        let s = (coords.y as FloatType * 180.0 / n_y - 90.0).to_radians();
        let n = ((coords.y as FloatType + 1.0) * 180.0 / n_y - 90.0).to_radians();
        (s, n)
    } else {
        let n = (90.0 - coords.y as FloatType * 180.0 / n_y).to_radians();
        let s = (90.0 - (coords.y as FloatType + 1.0) * 180.0 / n_y).to_radians();
        (s, n)
    };

    let sw = LngLat {
        lng: Rad::new(west_rad),
        lat: Rad::new(south_rad),
    };
    let ne = LngLat {
        lng: Rad::new(east_rad),
        lat: Rad::new(north_rad),
    };
    Extent::from_points(&[sw, ne])
}

#[derive(Debug, Clone, PartialEq)]
pub enum TerrainCrs {
    WebMercator { tms: bool },
    Geographic { tms: bool },
}

impl Default for TerrainCrs {
    fn default() -> Self {
        TerrainCrs::WebMercator { tms: false }
    }
}

impl TerrainCrs {
    pub fn tms(&self) -> bool {
        match self {
            TerrainCrs::WebMercator { tms } | TerrainCrs::Geographic { tms } => *tms,
        }
    }

    pub fn is_geographic(&self) -> bool {
        matches!(self, TerrainCrs::Geographic { .. })
    }

    pub fn build_url(&self, base_url: &str, xyz: &TileXYZ) -> String {
        match self {
            TerrainCrs::WebMercator { tms } => tile_url(base_url, xyz, *tms),
            TerrainCrs::Geographic { tms } => {
                // xyz is already a geographic tile coordinate; just apply TMS y-flip.
                let y = if *tms {
                    xyz.y
                } else {
                    let n_y = 1usize << xyz.z;
                    n_y - 1 - xyz.y
                };
                base_url
                    .replace("{x}", &xyz.x.to_string())
                    .replace("{y}", &y.to_string())
                    .replace("{z}", &xyz.z.to_string())
            }
        }
    }
}

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
        (earth_circumference * cos_lat) / (content_pixel_width * (texture_zoom as f64).exp2());
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

/// Build a tile URL for a server that uses EPSG:4326 geographic tiling.
///
/// Geographic tiling has 2^(z+1) tiles wide × 2^z tiles tall at server zoom z.
/// At server zoom z_s = wm_z - 1, geographic tile width equals WM tile width exactly
/// (180/2^(z_s) = 360/2^wm_z), giving a 1:1 mapping: geo_x == wm_x.
/// `tms` controls whether y=0 is at the south (TMS) or north.
pub fn tile_url_geographic(s: &str, xyz: &TileXYZ, tms: bool) -> String {
    let wm_z = xyz.z;
    // Use server zoom z_s = wm_z - 1 so geographic tile width matches WM tile width.
    // At z_s, there are 2^(z_s+1) = 2^wm_z geographic tiles wide → geo_x == wm_x.
    let z_s = wm_z.saturating_sub(1);
    let n_geo = (1usize << z_s) as f64; // 2^z_s

    // geo_x == wm_x (exact 1:1 since geographic tile width = WM tile width at z_s)
    let geo_x = xyz.x;

    // Compute center latitude of the WM tile to find the geographic row
    let n_wm = (1usize << wm_z) as f64;
    let mercator_n = std::f64::consts::PI * (1.0 - 2.0 * (xyz.y as f64 + 0.5) / n_wm);
    let lat_center = mercator_n.sinh().atan().to_degrees();

    let geo_y = if tms {
        // TMS: y=0 at south
        ((lat_center + 90.0) * n_geo / 180.0) as usize
    } else {
        // y=0 at north
        ((90.0 - lat_center) * n_geo / 180.0) as usize
    };

    s.replace("{x}", &geo_x.to_string())
        .replace("{y}", &geo_y.to_string())
        .replace("{z}", &z_s.to_string())
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
    fn test_geographic_tile_extent_direct_z0() {
        use std::f64::consts::PI;
        // z=0: 2 columns × 1 row, each tile is 180°×180°
        let west =
            TilingScheme::Geographic { tms: false }.tile_extent(TileXYZ { x: 0, y: 0, z: 0 });
        assert!((west.west.val() - (-PI)).abs() < 1e-10, "west tile west");
        assert!((west.east.val() - 0.0).abs() < 1e-10, "west tile east");
        assert!(
            (west.south.val() - (-PI / 2.0)).abs() < 1e-10,
            "west tile south"
        );
        assert!(
            (west.north.val() - (PI / 2.0)).abs() < 1e-10,
            "west tile north"
        );

        let east =
            TilingScheme::Geographic { tms: false }.tile_extent(TileXYZ { x: 1, y: 0, z: 0 });
        assert!((east.west.val() - 0.0).abs() < 1e-10, "east tile west");
        assert!((east.east.val() - PI).abs() < 1e-10, "east tile east");
    }

    #[test]
    fn test_geographic_tile_extent_direct_contiguous() {
        // Adjacent tiles at z=6 must share boundaries exactly
        let scheme = TilingScheme::Geographic { tms: true };
        let a = scheme.tile_extent(TileXYZ { x: 56, y: 45, z: 6 });
        let b = scheme.tile_extent(TileXYZ { x: 56, y: 46, z: 6 });
        assert!(
            (a.north.val() - b.south.val()).abs() < 1e-12,
            "vertical boundary"
        );

        let c = scheme.tile_extent(TileXYZ { x: 57, y: 45, z: 6 });
        assert!(
            (a.east.val() - c.west.val()).abs() < 1e-12,
            "horizontal boundary"
        );
    }

    #[test]
    fn test_tiling_scheme_root_tiles() {
        assert_eq!(TilingScheme::WebMercator.root_tiles().len(), 1);
        assert_eq!(
            TilingScheme::Geographic { tms: false }.root_tiles().len(),
            2
        );
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

    #[test]
    fn test_calc_meters_per_texel_sanity() {
        let a = 6378137.0;
        // Width includes 2px padding => content width = 256
        let m = calc_meters_per_texel(0, 0, 0, 258, a);
        assert!(m.is_finite() && m > 0.0);
        let expected = (2.0 * std::f64::consts::PI * a) / 256.0;
        let rel_err = ((m as f64) - expected).abs() / expected;
        assert!(rel_err < 1e-4, "unexpected relative error: {rel_err}");
        // Guard: texture_width < 2 must not underflow or divide by zero
        let m_tiny = calc_meters_per_texel(0, 0, 0, 1, a);
        assert!(m_tiny.is_finite() && m_tiny > 0.0);
    }
}
