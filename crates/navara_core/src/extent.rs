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

    pub fn contains(&self, point: &LngLat<F, U>) -> bool {
        let lng_in = if self.west <= self.east {
            point.lng >= self.west && point.lng <= self.east
        } else {
            // Antimeridian wrapping: extent spans across ±180°
            point.lng >= self.west || point.lng <= self.east
        };
        lng_in && point.lat >= self.south && point.lat <= self.north
    }

    /// Returns true if `self` fully contains `other`
    /// (all four corners of `other` are within `self`).
    /// Handles antimeridian-wrapping extents where `west > east`.
    pub fn contains_extent(&self, other: &Self) -> bool {
        let self_wraps = self.west > self.east;
        let other_wraps = other.west > other.east;

        let lng_contained = match (self_wraps, other_wraps) {
            (false, false) => self.west <= other.west && self.east >= other.east,
            (true, false) => other.west >= self.west || other.east <= self.east,
            (false, true) => false,
            (true, true) => self.west <= other.west && self.east >= other.east,
        };
        lng_contained && self.south <= other.south && self.north >= other.north
    }

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
    fn contains_wrapping_extent_point_inside() {
        use crate::Angle;
        // Extent spanning the antimeridian: west=170°, east=-170° (in radians)
        let wrapping: Extent<f64, Radians> = Extent {
            west: Angle::new(170_f64.to_radians()),
            south: Angle::new(-10_f64.to_radians()),
            east: Angle::new(-170_f64.to_radians()),
            north: Angle::new(10_f64.to_radians()),
        };
        // Point at 175° should be inside
        let inside = LngLat {
            lng: Angle::new(175_f64.to_radians()),
            lat: Angle::new(0_f64.to_radians()),
        };
        assert!(wrapping.contains(&inside));

        // Point at -175° should be inside
        let inside2 = LngLat {
            lng: Angle::new(-175_f64.to_radians()),
            lat: Angle::new(0_f64.to_radians()),
        };
        assert!(wrapping.contains(&inside2));

        // Point at 0° should be outside
        let outside = LngLat {
            lng: Angle::new(0_f64.to_radians()),
            lat: Angle::new(0_f64.to_radians()),
        };
        assert!(!wrapping.contains(&outside));
    }

    #[test]
    fn contains_extent_antimeridian_wrapping() {
        use crate::Angle;
        // Self wraps: [170°, -170°]
        let wrapping: Extent<f64, Radians> = Extent {
            west: Angle::new(170_f64.to_radians()),
            south: Angle::new(-10_f64.to_radians()),
            east: Angle::new(-170_f64.to_radians()),
            north: Angle::new(10_f64.to_radians()),
        };

        // Non-wrapping inner extent at [172°, 178°] — fits in west lobe
        let inner_west: Extent<f64, Radians> = Extent {
            west: Angle::new(172_f64.to_radians()),
            south: Angle::new(-5_f64.to_radians()),
            east: Angle::new(178_f64.to_radians()),
            north: Angle::new(5_f64.to_radians()),
        };
        assert!(wrapping.contains_extent(&inner_west));

        // Non-wrapping inner extent at [-178°, -172°] — fits in east lobe
        let inner_east: Extent<f64, Radians> = Extent {
            west: Angle::new(-178_f64.to_radians()),
            south: Angle::new(-5_f64.to_radians()),
            east: Angle::new(-172_f64.to_radians()),
            north: Angle::new(5_f64.to_radians()),
        };
        assert!(wrapping.contains_extent(&inner_east));

        // Non-wrapping extent clearly outside
        let outside: Extent<f64, Radians> = Extent {
            west: Angle::new(0_f64.to_radians()),
            south: Angle::new(-5_f64.to_radians()),
            east: Angle::new(10_f64.to_radians()),
            north: Angle::new(5_f64.to_radians()),
        };
        assert!(!wrapping.contains_extent(&outside));

        // Non-wrapping self cannot contain a wrapping other
        let non_wrapping: Extent<f64, Radians> = Extent {
            west: Angle::new(0_f64.to_radians()),
            south: Angle::new(-90_f64.to_radians()),
            east: Angle::new(90_f64.to_radians()),
            north: Angle::new(90_f64.to_radians()),
        };
        assert!(!non_wrapping.contains_extent(&wrapping));

        // Both wrap: larger wrapping contains smaller wrapping
        let larger_wrapping: Extent<f64, Radians> = Extent {
            west: Angle::new(160_f64.to_radians()),
            south: Angle::new(-20_f64.to_radians()),
            east: Angle::new(-160_f64.to_radians()),
            north: Angle::new(20_f64.to_radians()),
        };
        assert!(larger_wrapping.contains_extent(&wrapping));
        assert!(!wrapping.contains_extent(&larger_wrapping));
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
