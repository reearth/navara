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

impl<F: Float, U: Unit<F>> Default for Extent<F, U> {
    fn default() -> Self {
        Self {
            west: Angle::new(F::ZERO),
            south: Angle::new(F::ZERO),
            east: Angle::new(F::ZERO),
            north: Angle::new(F::ZERO),
        }
    }
}

impl<F: Float, U: Unit<F>> Extent<F, U> {
    pub fn from_points(ps: &[LngLat<F, U>]) -> Self {
        let first_p = ps.first().cloned().unwrap();
        let mut max = first_p;
        let mut min = first_p;
        for p in ps {
            max = max.max(p);
            min = min.min(p);
        }
        Self {
            west: min.lng,
            south: min.lat,
            east: max.lng,
            north: max.lat,
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

    /// Note: Assumes non-wrapping extents (west <= east).
    /// XYZ tiles are split at the antimeridian, so wrapping extents never occur in practice.
    pub fn contains(&self, point: &LngLat<F, U>) -> bool {
        point.lng >= self.west
            && point.lng <= self.east
            && point.lat >= self.south
            && point.lat <= self.north
    }

    /// Returns true if `self` fully contains `other`
    /// (all four corners of `other` are within `self`).
    /// Note: Assumes non-wrapping extents (west <= east).
    /// XYZ tiles are split at the antimeridian, so wrapping extents never occur in practice.
    pub fn contains_extent(&self, other: &Self) -> bool {
        self.west <= other.west
            && self.east >= other.east
            && self.south <= other.south
            && self.north >= other.north
    }

    /// Note: Assumes non-wrapping extents (west <= east).
    /// XYZ tiles are split at the antimeridian, so wrapping extents never occur in practice.
    pub fn intersects(&self, other: Self) -> bool {
        // West-south point
        (self.west <= other.west
            && self.south <= other.south
            && self.east >= other.west
            && self.north >= other.south)
            || (other.west <= self.west
                && other.south <= self.south
                && other.east >= self.west
                && other.north >= self.south)
            // East-north point
            || (self.east >= other.east
                && self.north >= other.north
                && self.west <= other.east
                && self.south <= other.north)
            || (other.east >= self.east
                && other.north >= self.north
                && other.west <= self.east
                && other.south <= self.north)
            // West-north point
            || (self.east >= other.west
                && self.north >= other.north
                && self.west <= other.west
                && self.south <= other.north)
            || (other.east >= self.west
                && other.north >= self.north
                && other.west <= self.west
                && other.south <= self.north)
            // East-south point
            || (self.east >= other.east
                && self.north >= other.south
                && self.west <= other.east
                && self.south <= other.south)
            || (other.east >= self.east
                && other.north >= self.south
                && other.west <= self.east
                && other.south <= self.south)
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

    // This just calculates approximated value. If you want to calculate correct value, you should not use this function.
    pub fn ratio(&self, other: &Self) -> F {
        let this_lat_diff = (self.north.val() - self.south.val()).abs();
        let this_lng_diff = (self.east.val() - self.west.val()).abs();
        let other_lat_diff = (other.north.val() - other.south.val()).abs();
        let other_lng_diff = (other.east.val() - other.west.val()).abs();

        let this_area = this_lat_diff * this_lng_diff;
        let other_area = other_lat_diff * other_lng_diff;

        this_area / other_area
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

#[cfg(test)]
mod test {

    use radians::{Degrees, Radians};

    use crate::LngLat;

    use super::Extent;

    #[test]
    fn it_should_intersect_with_another_extent() {
        let e1: Extent<f32, Degrees> = Extent::from_points(&[
            LngLat::new(2.678_923_1, 16.874_407),
            LngLat::new(2.678_923_1, 1.488_755_1),
            LngLat::new(25.424_458, 1.488_755_1),
            LngLat::new(25.424_458, 16.874_407),
        ]);
        let e2: Extent<f32, Degrees> = Extent::from_points(&[
            LngLat::new(19.560_308, 7.993_39),
            LngLat::new(19.560_308, -3.537_225_2),
            LngLat::new(31.584_736, -3.537_225_2),
            LngLat::new(31.584_736, 7.993_39),
        ]);
        let e3: Extent<f32, Degrees> = Extent::from_points(&[
            LngLat::new(5.352_913_4, 13.874_271),
            LngLat::new(5.352_913_4, 10.050_75),
            LngLat::new(10.621_843, 10.050_75),
            LngLat::new(10.621_843, 13.874_271),
        ]);

        assert!(e1.intersects(e2));
        assert!(e1.intersects(e3));
        assert!(!e2.intersects(e3));
    }

    #[test]
    fn contains_extent_fully_inside() {
        use crate::Angle;
        let outer: Extent<f64, Radians> = Extent {
            west: Angle::new(0.0),
            south: Angle::new(0.0),
            east: Angle::new(1.0),
            north: Angle::new(1.0),
        };
        let inner: Extent<f64, Radians> = Extent {
            west: Angle::new(0.2),
            south: Angle::new(0.2),
            east: Angle::new(0.8),
            north: Angle::new(0.8),
        };
        assert!(outer.contains_extent(&inner));
        assert!(!inner.contains_extent(&outer));
    }

    #[test]
    fn contains_extent_identical() {
        use crate::Angle;
        let e: Extent<f64, Radians> = Extent {
            west: Angle::new(0.0),
            south: Angle::new(0.0),
            east: Angle::new(1.0),
            north: Angle::new(1.0),
        };
        assert!(e.contains_extent(&e));
    }

    #[test]
    fn contains_extent_partial_overlap_returns_false() {
        use crate::Angle;
        let a: Extent<f64, Radians> = Extent {
            west: Angle::new(0.0),
            south: Angle::new(0.0),
            east: Angle::new(1.0),
            north: Angle::new(1.0),
        };
        let b: Extent<f64, Radians> = Extent {
            west: Angle::new(0.5),
            south: Angle::new(0.5),
            east: Angle::new(1.5),
            north: Angle::new(1.5),
        };
        assert!(a.intersects(b));
        assert!(!a.contains_extent(&b));
        assert!(!b.contains_extent(&a));
    }

    #[test]
    fn contains_extent_disjoint_returns_false() {
        use crate::Angle;
        let a: Extent<f64, Radians> = Extent {
            west: Angle::new(0.0),
            south: Angle::new(0.0),
            east: Angle::new(1.0),
            north: Angle::new(1.0),
        };
        let b: Extent<f64, Radians> = Extent {
            west: Angle::new(2.0),
            south: Angle::new(2.0),
            east: Angle::new(3.0),
            north: Angle::new(3.0),
        };
        assert!(!a.contains_extent(&b));
        assert!(!b.contains_extent(&a));
    }

    #[test]
    fn it_should_check_if_its_angle_within_diff() {
        let e1: Extent<f32, Degrees> = Extent::from_points(&[
            LngLat::new(139.74272, 35.694575),
            LngLat::new(139.74272, 35.665498),
            LngLat::new(139.78024, 35.665498),
            LngLat::new(139.78024, 35.694575),
        ]);
        let e1: Extent<f32, Radians> = e1.into();
        let e2: Extent<f32, Degrees> = Extent::from_points(&[
            LngLat::new(139.75002, 35.69018),
            LngLat::new(139.75002, 35.68278),
            LngLat::new(139.76229, 35.68278),
            LngLat::new(139.76229, 35.69018),
        ]);
        let e2: Extent<f32, Radians> = e2.into();
        let e3: Extent<f32, Degrees> = Extent::from_points(&[
            LngLat::new(139.76084, 35.77462),
            LngLat::new(139.19915, 35.77462),
            LngLat::new(139.19915, 35.37846),
            LngLat::new(139.76084, 35.37846),
        ]);
        let e3: Extent<f32, Radians> = e3.into();

        assert!(e1.ratio(&e3) < 1.);
        assert!(e1.ratio(&e2) > 1.);
        // assert!(!e2.intersects(e3));
    }
}
