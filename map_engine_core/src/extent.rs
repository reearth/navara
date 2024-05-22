use crate::{Angle, Degrees, Float, LngLat, Radians, Unit};

pub struct Extent<F: Float, U: Unit<F>> {
    pub west: Angle<F, U>,
    pub south: Angle<F, U>,
    pub east: Angle<F, U>,
    pub north: Angle<F, U>,
}

impl<F: Float, U: Unit<F>> Copy for Extent<F, U> {}

impl<F: Float, U: Unit<F>> PartialEq for Extent<F, U> {
    fn eq(&self, other: &Self) -> bool {
        self.west == other.west
            && self.south == other.south
            && self.east == other.east
            && self.north == other.north
    }
}

impl<F: Float + Clone, U: Unit<F>> Clone for Extent<F, U> {
    fn clone(&self) -> Self {
        *self
    }
}

impl<F: Float + std::fmt::Debug, U: Unit<F>> std::fmt::Debug for Extent<F, U> {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(
            f,
            "Extent {{ west: {:?}, south: {:?}, east: {:?}, north: {:?} }}",
            self.west, self.south, self.east, self.north
        )
    }
}

impl<F: Float + std::fmt::Display, U: Unit<F>> std::fmt::Display for Extent<F, U> {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(
            f,
            "Extent {{ west: {}, south: {}, east: {}, north: {} }}",
            self.west, self.south, self.east, self.north
        )
    }
}

impl<F: Float, U: Unit<F>> Extent<F, U> {
    pub fn from_points(p1: LngLat<F, U>, p2: LngLat<F, U>) -> Self {
        Self {
            west: p1.lng.min(p2.lng),
            south: p1.lat.min(p2.lat),
            east: p1.lng.max(p2.lng),
            north: p1.lat.max(p2.lat),
        }
    }

    pub fn north_east(&self) -> LngLat<F, U> {
        LngLat {
            lng: self.east,
            lat: self.north,
        }
    }

    pub fn south_west(&self) -> LngLat<F, U> {
        LngLat {
            lng: self.west,
            lat: self.south,
        }
    }

    pub fn contains(&self, point: LngLat<F, U>) -> bool {
        point.lng >= self.west
            && point.lng <= self.east
            && point.lat >= self.south
            && point.lat <= self.north
    }

    pub fn intersects(&self, other: Self) -> bool {
        (self.west <= other.west
            && self.south <= other.south
            && self.east >= other.west
            && self.north >= other.south)
            || (other.west <= self.west
                && other.south <= self.south
                && other.east >= self.west
                && other.north >= self.south)
            || (self.east >= other.east
                && self.north >= other.north
                && self.west <= other.east
                && self.south <= other.north)
            || (other.east >= self.east
                && other.north >= self.north
                && other.west <= self.east
                && other.south <= self.north)
    }

    pub fn intersection(&self, other: Self) -> Option<Self> {
        if self.intersects(other) {
            Some(Self {
                west: self.west.max(other.west),
                south: self.south.max(other.south),
                east: self.east.min(other.east),
                north: self.north.min(other.north),
            })
        } else {
            None
        }
    }

    pub fn union(&self, other: Self) -> Self {
        Self {
            west: self.west.min(other.west),
            south: self.south.min(other.south),
            east: self.east.max(other.east),
            north: self.north.max(other.north),
        }
    }
}

impl<F: Float> From<Extent<F, Radians>> for Extent<F, Degrees> {
    fn from(extent: Extent<F, Radians>) -> Self {
        Self {
            west: extent.west.deg(),
            south: extent.south.deg(),
            east: extent.east.deg(),
            north: extent.north.deg(),
        }
    }
}

impl<F: Float> From<Extent<F, Degrees>> for Extent<F, Radians> {
    fn from(extent: Extent<F, Degrees>) -> Self {
        Self {
            west: extent.west.rad(),
            south: extent.south.rad(),
            east: extent.east.rad(),
            north: extent.north.rad(),
        }
    }
}
