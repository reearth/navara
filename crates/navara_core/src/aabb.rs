use crate::{Angle, Extent, LLE, Meters, Radians, WGS84_64};
use bevy_ecs::component::Component;
use navara_math::{FloatType, Vec3};

use super::Plane;

#[derive(Debug, Default, Clone, Component)]
pub struct Aabb {
    pub center: Vec3,
    pub extents: Vec3,
}

impl Aabb {
    /// Returns the minimum corner of the bounding box
    #[inline]
    pub fn min(&self) -> Vec3 {
        self.center - self.extents
    }

    /// Returns the maximum corner of the bounding box
    #[inline]
    pub fn max(&self) -> Vec3 {
        self.center + self.extents
    }
}

#[derive(Debug, Default, Clone, Copy, PartialEq)]
pub struct BoundingSphere {
    pub center: Vec3,
    pub radius: FloatType,
}

impl Aabb {
    pub fn from_vec3(ps: &[Vec3]) -> Self {
        let first_vec = *ps.first().unwrap();
        let mut max = first_vec;
        let mut min = first_vec;
        for p in ps {
            max.x = max.x.max(p.x);
            max.y = max.y.max(p.y);
            max.z = max.z.max(p.z);

            min.x = min.x.min(p.x);
            min.y = min.y.min(p.y);
            min.z = min.z.min(p.z);
        }

        // It's just center between two points, not on the spherical surface.
        let center = (max + min) * 0.5;
        let extents = max - center;
        Self { center, extents }
    }

    pub fn from_points(ps: &[f64]) -> Self {
        let first_vec = Vec3::new(ps[0], ps[1], ps[2]);
        let mut max = first_vec;
        let mut min = first_vec;
        for i in 0..(ps.len() / 3) {
            let i = i * 3;
            let x = ps[i];
            let y = ps[i + 1];
            let z = ps[i + 2];
            max.x = max.x.max(x);
            max.y = max.y.max(y);
            max.z = max.z.max(z);

            min.x = min.x.min(x);
            min.y = min.y.min(y);
            min.z = min.z.min(z);
        }

        // It's just center between two points, not on the spherical surface.
        let center = (max + min) * 0.5;
        let extents = max - center;
        Self { center, extents }
    }

    pub fn from_extent_f64(
        extent: Extent<FloatType, Radians>,
        min_height: FloatType,
        max_height: FloatType,
    ) -> Self {
        let ellipsoid = WGS84_64;

        let mut nw = LLE {
            lng: extent.west,
            lat: extent.north,
            height: Meters::new(max_height),
        };
        let mut ne = LLE {
            lng: extent.east,
            lat: extent.north,
            height: Meters::new(max_height),
        };
        let mut se = LLE {
            lng: extent.east,
            lat: extent.south,
            height: Meters::new(max_height),
        };
        let mut sw = LLE {
            lng: extent.west,
            lat: extent.south,
            height: Meters::new(max_height),
        };

        let center = LLE {
            lng: Angle::new((sw.lng.val() + ne.lng.val()) / 2.),
            lat: Angle::new((sw.lat.val() + ne.lat.val()) / 2.),
            height: Meters::new((max_height + min_height) / 2.),
        };

        // Max
        let p_nw_max = ellipsoid.lle_to_xyz(nw);
        let p_ne_max = ellipsoid.lle_to_xyz(ne);
        let p_se_max = ellipsoid.lle_to_xyz(se);
        let p_sw_max = ellipsoid.lle_to_xyz(sw);
        // Min
        let min_height = Meters::new(min_height);
        nw.height = min_height;
        ne.height = min_height;
        se.height = min_height;
        sw.height = min_height;
        let p_nw_min = ellipsoid.lle_to_xyz(nw);
        let p_ne_min = ellipsoid.lle_to_xyz(ne);
        let p_se_min = ellipsoid.lle_to_xyz(se);
        let p_sw_min = ellipsoid.lle_to_xyz(sw);

        let p_center = ellipsoid.lle_to_xyz(center);

        let max_x = p_nw_max
            .x
            .val()
            .max(p_ne_max.x.val())
            .max(p_se_max.x.val())
            .max(p_sw_max.x.val())
            .max(p_nw_min.x.val())
            .max(p_ne_min.x.val())
            .max(p_se_min.x.val())
            .max(p_sw_min.x.val())
            .max(p_center.x.val());
        let max_y = p_nw_max
            .y
            .val()
            .max(p_ne_max.y.val())
            .max(p_se_max.y.val())
            .max(p_sw_max.y.val())
            .max(p_nw_min.y.val())
            .max(p_ne_min.y.val())
            .max(p_se_min.y.val())
            .max(p_sw_min.y.val())
            .max(p_center.y.val());
        let max_z = p_nw_max
            .z
            .val()
            .max(p_ne_max.z.val())
            .max(p_se_max.z.val())
            .max(p_sw_max.z.val())
            .max(p_nw_min.z.val())
            .max(p_ne_min.z.val())
            .max(p_se_min.z.val())
            .max(p_sw_min.z.val())
            .max(p_center.z.val());
        let min_x = p_nw_max
            .x
            .val()
            .min(p_ne_max.x.val())
            .min(p_se_max.x.val())
            .min(p_sw_max.x.val())
            .min(p_nw_min.x.val())
            .min(p_ne_min.x.val())
            .min(p_se_min.x.val())
            .min(p_sw_min.x.val())
            .min(p_center.x.val());
        let min_y = p_nw_max
            .y
            .val()
            .min(p_ne_max.y.val())
            .min(p_se_max.y.val())
            .min(p_sw_max.y.val())
            .min(p_nw_min.y.val())
            .min(p_ne_min.y.val())
            .min(p_se_min.y.val())
            .min(p_sw_min.y.val())
            .min(p_center.y.val());
        let min_z = p_nw_max
            .z
            .val()
            .min(p_ne_max.z.val())
            .min(p_se_max.z.val())
            .min(p_sw_max.z.val())
            .min(p_nw_min.z.val())
            .min(p_ne_min.z.val())
            .min(p_se_min.z.val())
            .min(p_sw_min.z.val())
            .min(p_center.z.val());

        // Use the midpoint of min/max as the AABB center for symmetric extents.
        // This allows min() and max() to be computed accurately as center ± extents.
        let center = Vec3::new(
            (max_x + min_x) / 2.,
            (max_y + min_y) / 2.,
            (max_z + min_z) / 2.,
        );
        let extents = Vec3::new(max_x - center.x, max_y - center.y, max_z - center.z);

        Self { center, extents }
    }

    pub fn update(
        &mut self,
        extent: Extent<FloatType, Radians>,
        min_height: FloatType,
        max_height: FloatType,
    ) {
        let next = Self::from_extent_f64(extent, min_height, max_height);
        self.center = next.center;
        self.extents = next.extents;
    }

    pub fn is_on_or_forward_plane(&self, plane: &Plane) -> bool {
        let r = self.extents.dot(plane.normal.abs().as_dvec3());

        plane.get_distance_to_point(self.center) >= -r
    }

    pub fn distance_to_point(&self, p: Vec3) -> f64 {
        let min = self.center - self.extents;
        let max = self.center + self.extents;

        let clamped_point = Vec3::new(
            p.x.max(min.x).min(max.x),
            p.y.max(min.y).min(max.y),
            p.z.max(min.z).min(max.z),
        );

        p.distance(clamped_point)
    }
}

#[cfg(test)]
mod test {
    use approx::assert_abs_diff_eq;
    use navara_math::{EPSILON7, Vec3};

    use crate::{Angle, Extent, LLE, Meters, WGS84_64};

    use super::{Aabb, Plane};

    #[test]
    fn aabb_should_on_or_forward_plane() {
        // Aabb is under the plane, and the direction of the plane is bottom
        let plane = Plane::from_point_normal(Vec3::new(0., 2., -1.), Vec3::new(0., -1., 0.));
        let aabb = Aabb::from_vec3(&[Vec3::new(-1., -1., -1.), Vec3::new(1., 1., 1.)]);
        debug_assert!(aabb.is_on_or_forward_plane(&plane));

        // Aabb is above the plane, and the direction of the plane is top
        let plane = Plane::from_point_normal(Vec3::new(0., 2., -1.), Vec3::new(0., 1., 0.));
        let aabb = Aabb::from_vec3(&[Vec3::new(-1., -1., -1.), Vec3::new(1., 1., 1.)]);
        debug_assert!(!aabb.is_on_or_forward_plane(&plane));

        // Aabb is intersecting with the plane, and the direction of the plane is top
        let plane = Plane::from_point_normal(Vec3::new(0., 1., -1.), Vec3::new(0., 1., 0.));
        let aabb = Aabb::from_vec3(&[Vec3::new(-1., -1., -1.), Vec3::new(1., 1.1, 1.)]);
        debug_assert!(aabb.is_on_or_forward_plane(&plane));

        // Aabb is intersecting with the plane, and the direction of the plane is back
        let plane = Plane::from_point_normal(Vec3::new(0., 0., -1.), Vec3::new(0., 0., 1.));
        let aabb = Aabb::from_vec3(&[Vec3::new(0., 0., 0.), Vec3::new(0., 0., 0.)]);
        debug_assert!(aabb.is_on_or_forward_plane(&plane));
        let aabb = Aabb::from_vec3(&[Vec3::new(-1., 0., -1.), Vec3::new(1., 0., 1.)]);
        debug_assert!(aabb.is_on_or_forward_plane(&plane));
    }

    #[test]
    fn it_should_return_a_distance_between_point() {
        let point = Vec3::new(0., 3., 0.);
        let aabb = Aabb::from_vec3(&[Vec3::new(-1., -1., -1.), Vec3::new(1., 1., 1.)]);
        assert_eq!(aabb.distance_to_point(point), 2.);

        let point = Vec3::new(0., -3., 0.);
        let aabb = Aabb::from_vec3(&[Vec3::new(-1., -1., -1.), Vec3::new(1., 1., 1.)]);
        assert_eq!(aabb.distance_to_point(point), 2.);

        let point = Vec3::new(3., 3., -3.);
        let aabb = Aabb::from_vec3(&[Vec3::new(-1., -1., -1.), Vec3::new(1., 1., 1.)]);
        assert_abs_diff_eq!(aabb.distance_to_point(point), 3.4641016, epsilon = EPSILON7);
    }

    #[test]
    fn from_extent_f64_center_should_be_midpoint_of_bounds() {
        // Create an extent for a tile (Tokyo area, approximately)
        // Convert degrees to radians
        let west_deg = 139.0_f64;
        let south_deg = 35.0_f64;
        let east_deg = 140.0_f64;
        let north_deg = 36.0_f64;

        let extent = Extent {
            west: Angle::new(west_deg.to_radians()),
            south: Angle::new(south_deg.to_radians()),
            east: Angle::new(east_deg.to_radians()),
            north: Angle::new(north_deg.to_radians()),
        };
        let min_height = 0.0;
        let max_height = 100.0;

        let aabb = Aabb::from_extent_f64(extent, min_height, max_height);

        // The center should be the midpoint of min and max bounds
        let expected_center = (aabb.min() + aabb.max()) * 0.5;

        // Verify that the AABB center is the midpoint (allowing min/max to be computed correctly)
        assert_abs_diff_eq!(aabb.center.x, expected_center.x, epsilon = EPSILON7);
        assert_abs_diff_eq!(aabb.center.y, expected_center.y, epsilon = EPSILON7);
        assert_abs_diff_eq!(aabb.center.z, expected_center.z, epsilon = EPSILON7);
    }

    #[test]
    fn from_extent_f64_should_cover_all_corner_points() {
        // Create an extent for a tile
        // Convert degrees to radians
        let west_deg = 139.0_f64;
        let south_deg = 35.0_f64;
        let east_deg = 140.0_f64;
        let north_deg = 36.0_f64;

        let extent = Extent {
            west: Angle::new(west_deg.to_radians()),
            south: Angle::new(south_deg.to_radians()),
            east: Angle::new(east_deg.to_radians()),
            north: Angle::new(north_deg.to_radians()),
        };
        let min_height = 0.0;
        let max_height = 100.0;

        let aabb = Aabb::from_extent_f64(extent, min_height, max_height);
        let ellipsoid = WGS84_64;

        // Generate all 8 corner points
        let corners = [
            // At max height
            LLE {
                lng: extent.west,
                lat: extent.north,
                height: Meters::new(max_height),
            },
            LLE {
                lng: extent.east,
                lat: extent.north,
                height: Meters::new(max_height),
            },
            LLE {
                lng: extent.east,
                lat: extent.south,
                height: Meters::new(max_height),
            },
            LLE {
                lng: extent.west,
                lat: extent.south,
                height: Meters::new(max_height),
            },
            // At min height
            LLE {
                lng: extent.west,
                lat: extent.north,
                height: Meters::new(min_height),
            },
            LLE {
                lng: extent.east,
                lat: extent.north,
                height: Meters::new(min_height),
            },
            LLE {
                lng: extent.east,
                lat: extent.south,
                height: Meters::new(min_height),
            },
            LLE {
                lng: extent.west,
                lat: extent.south,
                height: Meters::new(min_height),
            },
        ];

        let min = aabb.min();
        let max = aabb.max();

        // Verify that all corner points are inside the AABB bounds
        for corner_lle in corners {
            let corner = ellipsoid.lle_to_xyz(corner_lle);
            let x = corner.x.val();
            let y = corner.y.val();
            let z = corner.z.val();

            // Each corner should be within the AABB bounds (with small epsilon for floating point)
            assert!(
                x >= min.x - EPSILON7 && x <= max.x + EPSILON7,
                "Corner x={} is outside AABB bounds [{}, {}]",
                x,
                min.x,
                max.x
            );
            assert!(
                y >= min.y - EPSILON7 && y <= max.y + EPSILON7,
                "Corner y={} is outside AABB bounds [{}, {}]",
                y,
                min.y,
                max.y
            );
            assert!(
                z >= min.z - EPSILON7 && z <= max.z + EPSILON7,
                "Corner z={} is outside AABB bounds [{}, {}]",
                z,
                min.z,
                max.z
            );
        }
    }
}
