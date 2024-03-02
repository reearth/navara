use std::f64::consts::PI;

use crate::{Extent, LngLat, Rad, Radians};

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

#[derive(Debug, Copy, Clone, PartialEq, Eq)]
pub struct TileXYZ {
    pub x: usize,
    pub y: usize,
    pub z: usize,
}

impl TileXYZ {
    /// Returns the number of tiles in the x and y direction at this zoom level.
    pub fn n(self) -> usize {
        2_usize.pow(self.z as u32)
    }

    /// Returns the normalized world position of the north-west corner of the tile.
    pub fn north_west_world_pos(self) -> (f64, f64) {
        let n = self.n() as f64;
        (self.x as f64 / n, self.y as f64 / n)
    }

    /// Returns the normalized world position of the north-east corner of the tile.
    pub fn extent(self) -> Extent<f64, Radians> {
        let e1 = self.north_west_world_pos();
        let e2 = (TileXYZ {
            x: self.x + 1,
            y: self.y + 1,
            z: self.z,
        })
        .north_west_world_pos();
        let p1 = web_mercator_world_pos_to_lnglat(e1.0, e1.1);
        let p2 = web_mercator_world_pos_to_lnglat(e2.0, e2.1);
        Extent::from_points(p1, p2)
    }
}

/// Converts a normalized world position in Web mercator to a longitude and latitude.
pub fn web_mercator_world_pos_to_lnglat(x: f64, y: f64) -> LngLat<f64, Radians> {
    let lng = x * (2.0 * PI) - PI;
    let phi = PI - 2.0 * PI * y; // y=0 -> PI, y=1 -> -PI
    let lat = 2.0 * (phi.exp().atan() - PI / 4.0);
    LngLat {
        lng: Rad::new(lng),
        lat: Rad::new(lat),
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
    fn test_tile_extent() {
        let max_lat: f64 = 2.0 * (((PI - 2.0 * PI * 0.0).exp().atan()) - PI / 4.0);
        let min_lat: f64 = 2.0 * (((PI - 2.0 * PI * 1.0).exp().atan()) - PI / 4.0);

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
