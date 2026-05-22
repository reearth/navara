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

#[derive(Debug, Default, Clone, Copy, PartialEq, Component)]
pub struct BoundingSphere {
    pub center: Vec3,
    pub radius: FloatType,
}

impl BoundingSphere {
    pub fn new(center: Vec3, radius: FloatType) -> Self {
        Self { center, radius }
    }

    /// Distance from `p` to the sphere surface, or 0 if `p` is inside.
    pub fn distance_to_point(&self, p: Vec3) -> FloatType {
        let d = p.distance(self.center) - self.radius;
        if d < 0.0 { 0.0 } else { d }
    }

    /// Conservative plane-side test. The sphere is "on or forward" iff the
    /// signed plane distance to the center is at least `-radius`.
    pub fn is_on_or_forward_plane(&self, plane: &Plane) -> bool {
        plane.get_distance_to_point(self.center) >= -self.radius
    }
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
        // The geographic extent describes a curved patch on the ellipsoid, so
        // four corners + a center cannot enclose the surface bulge between them
        // once the patch grows beyond a few degrees. Sample on a grid whose
        // step in lng/lat is bounded by `MAX_ANGULAR_STEP_RAD`, so the chord
        // between adjacent samples stays close to the underlying arc (≈ 2 km
        // at the equator for a ~2.9° step). The resulting AABB then conservatively
        // contains the whole region across all camera orientations.
        const MAX_ANGULAR_STEP_RAD: FloatType = 0.05;

        let ellipsoid = WGS84_64;

        let west = extent.west.val();
        let east = extent.east.val();
        let south = extent.south.val();
        let north = extent.north.val();

        let lng_span = (east - west).abs();
        let lat_span = (north - south).abs();

        // At least one segment (two samples) per dimension so the four corners
        // are always included, even when the extent is degenerate.
        let lng_segments = (lng_span / MAX_ANGULAR_STEP_RAD).ceil().max(1.0) as usize;
        let lat_segments = (lat_span / MAX_ANGULAR_STEP_RAD).ceil().max(1.0) as usize;

        let max_height_m = Meters::new(max_height);
        let min_height_m = Meters::new(min_height);

        let mut max_x = FloatType::NEG_INFINITY;
        let mut max_y = FloatType::NEG_INFINITY;
        let mut max_z = FloatType::NEG_INFINITY;
        let mut min_x = FloatType::INFINITY;
        let mut min_y = FloatType::INFINITY;
        let mut min_z = FloatType::INFINITY;

        for i in 0..=lng_segments {
            let t_lng = i as FloatType / lng_segments as FloatType;
            let lng = Angle::new(west + (east - west) * t_lng);
            for j in 0..=lat_segments {
                let t_lat = j as FloatType / lat_segments as FloatType;
                let lat = Angle::new(south + (north - south) * t_lat);
                for height in [max_height_m, min_height_m] {
                    let p = ellipsoid.lle_to_xyz(LLE { lng, lat, height });
                    let (x, y, z) = (p.x.val(), p.y.val(), p.z.val());
                    if x > max_x {
                        max_x = x;
                    }
                    if y > max_y {
                        max_y = y;
                    }
                    if z > max_z {
                        max_z = z;
                    }
                    if x < min_x {
                        min_x = x;
                    }
                    if y < min_y {
                        min_y = y;
                    }
                    if z < min_z {
                        min_z = z;
                    }
                }
            }
        }

        // Inflate the extents by a conservative chord-arc gap. Sampled points
        // sit on the ellipsoid, but the surface between adjacent samples bulges
        // outward by up to `r * (1 - cos(diag/2))`, where `diag` is the angular
        // distance from a grid sample to the worst-case interior point of its
        // cell. Padding the AABB by this amount keeps the box conservative
        // without re-sampling at a finer step.
        let lng_step = lng_span / lng_segments as FloatType;
        let lat_step = lat_span / lat_segments as FloatType;
        let half_diag = (lng_step * lng_step + lat_step * lat_step).sqrt() * 0.5;
        let outer_radius = ellipsoid.semi_major_axis() + max_height.max(0.0);
        let padding = outer_radius * (1.0 - half_diag.cos());

        // Use the midpoint of min/max as the AABB center for symmetric extents.
        // This allows min() and max() to be computed accurately as center ± extents.
        let center = Vec3::new(
            (max_x + min_x) / 2.,
            (max_y + min_y) / 2.,
            (max_z + min_z) / 2.,
        );
        let extents = Vec3::new(
            max_x - center.x + padding,
            max_y - center.y + padding,
            max_z - center.z + padding,
        );

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

    #[test]
    fn from_extent_f64_should_cover_curved_surface_for_large_region() {
        // Reproduces the buildings.reearth.land issue: the root tileset's
        // direct children are quarter-Earth extents whose ellipsoid surface
        // bulges far outside the 9-point sample envelope used previously.
        // The chosen NE quadrant is the same extent that Cesium 3D Tiles emits
        // for the (1, 1, 1) child of a global region root.
        let extent = Extent {
            west: Angle::new(0.0),
            south: Angle::new(0.0),
            east: Angle::new(std::f64::consts::PI),
            north: Angle::new(1.4844222297453327),
        };
        let min_height = 0.0;
        let max_height = 1000.0;

        let aabb = Aabb::from_extent_f64(extent, min_height, max_height);
        let ellipsoid = WGS84_64;
        let min = aabb.min();
        let max = aabb.max();

        // Interior points that the old 9-point sampler missed: the equator
        // bulges away from the corner chord at off-meridian longitudes.
        let probes = [
            LLE {
                lng: Angle::new(std::f64::consts::PI / 2.0),
                lat: Angle::new(0.0),
                height: Meters::new(0.0),
            },
            LLE {
                lng: Angle::new(std::f64::consts::PI / 4.0),
                lat: Angle::new(0.0),
                height: Meters::new(0.0),
            },
            LLE {
                lng: Angle::new(3.0 * std::f64::consts::PI / 4.0),
                lat: Angle::new(0.0),
                height: Meters::new(0.0),
            },
            LLE {
                lng: Angle::new(std::f64::consts::PI / 2.0),
                lat: Angle::new(0.5),
                height: Meters::new(500.0),
            },
        ];

        for probe in probes {
            let p = ellipsoid.lle_to_xyz(probe);
            let (x, y, z) = (p.x.val(), p.y.val(), p.z.val());
            assert!(
                x >= min.x - EPSILON7 && x <= max.x + EPSILON7,
                "Probe x={} is outside AABB bounds [{}, {}]",
                x,
                min.x,
                max.x
            );
            assert!(
                y >= min.y - EPSILON7 && y <= max.y + EPSILON7,
                "Probe y={} is outside AABB bounds [{}, {}]",
                y,
                min.y,
                max.y
            );
            assert!(
                z >= min.z - EPSILON7 && z <= max.z + EPSILON7,
                "Probe z={} is outside AABB bounds [{}, {}]",
                z,
                min.z,
                max.z
            );
        }
    }

    use super::BoundingSphere;

    #[test]
    fn bounding_sphere_distance_outside_inside_on_surface() {
        let sphere = BoundingSphere::new(Vec3::ZERO, 5.0);

        // Outside: Euclidean - radius.
        assert_abs_diff_eq!(
            sphere.distance_to_point(Vec3::new(13., 0., 0.)),
            8.0,
            epsilon = EPSILON7
        );
        // On the surface: distance is 0 (and the function must not return a
        // small negative value from floating-point error).
        assert_abs_diff_eq!(
            sphere.distance_to_point(Vec3::new(5., 0., 0.)),
            0.0,
            epsilon = EPSILON7
        );
        // Strictly inside: clamped to 0.
        assert_eq!(sphere.distance_to_point(Vec3::new(1., 0., 0.)), 0.0);
        // Dead center: also 0.
        assert_eq!(sphere.distance_to_point(Vec3::ZERO), 0.0);
    }

    /// A degenerate sphere with radius 0 acts like a point — distance equals
    /// the Euclidean distance to the center.
    #[test]
    fn bounding_sphere_zero_radius_acts_as_point() {
        let sphere = BoundingSphere::new(Vec3::new(1., 2., 3.), 0.0);
        assert_abs_diff_eq!(
            sphere.distance_to_point(Vec3::new(4., 6., 3.)),
            5.0,
            epsilon = EPSILON7
        );
        assert_eq!(sphere.distance_to_point(Vec3::new(1., 2., 3.)), 0.0);
    }

    #[test]
    fn bounding_sphere_is_on_or_forward_plane_three_cases() {
        let sphere = BoundingSphere::new(Vec3::new(0., 5., 0.), 1.0);

        // Plane at y=0 facing +Y. Sphere fully in front (y∈[4, 6]).
        let plane = Plane::from_point_normal(Vec3::new(0., 0., 0.), Vec3::new(0., 1., 0.));
        assert!(sphere.is_on_or_forward_plane(&plane));

        // Plane at y=10 facing +Y. Sphere fully behind.
        let plane = Plane::from_point_normal(Vec3::new(0., 10., 0.), Vec3::new(0., 1., 0.));
        assert!(!sphere.is_on_or_forward_plane(&plane));

        // Plane tangent to the sphere from behind (y=4 facing +Y). Center
        // distance = 1 = radius, so still considered "on or forward".
        let plane = Plane::from_point_normal(Vec3::new(0., 4., 0.), Vec3::new(0., 1., 0.));
        assert!(sphere.is_on_or_forward_plane(&plane));

        // Plane just past the back face (y=4.5 facing +Y, but with sphere
        // center at y=5 radius 1, center is 0.5 in front, half the radius
        // crosses — still forward).
        let plane = Plane::from_point_normal(Vec3::new(0., 4.5, 0.), Vec3::new(0., 1., 0.));
        assert!(sphere.is_on_or_forward_plane(&plane));
    }
}
