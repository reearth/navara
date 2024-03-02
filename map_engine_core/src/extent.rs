use crate::{Angle, Float, LngLat, Unit};

#[derive(Debug, Copy, Clone, PartialEq)]
pub struct Extent<F: Float, U: Unit<F>> {
    pub west: Angle<F, U>,
    pub south: Angle<F, U>,
    pub east: Angle<F, U>,
    pub north: Angle<F, U>,
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

    pub fn intersects(&self, other: &Self) -> bool {
        self.west < other.east
            && self.east > other.west
            && self.south < other.north
            && self.north > other.south
    }

    pub fn intersection(&self, other: &Self) -> Option<Self> {
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

    pub fn union(&self, other: &Self) -> Self {
        Self {
            west: self.west.min(other.west),
            south: self.south.min(other.south),
            east: self.east.max(other.east),
            north: self.north.max(other.north),
        }
    }
}
