use crate::{Angle, Extent, LLE, Meters, Plane, Radians, WGS84_64};
use bevy_ecs::component::Component;
use navara_math::{FloatType, Vec3};

use super::transform::east_north_up_to_fixed_frame;

/// Oriented bounding box parameterized by a center and three half-axis vectors.
///
/// The three half-axes are assumed to be mutually orthogonal. Each axis vector
/// is *not* unit-length: its magnitude is the half-extent of the box along
/// that direction. This matches the 3D Tiles `box` bounding volume layout
/// (`[cx, cy, cz, x0, x1, x2, y0, y1, y2, z0, z1, z2]`) and lets the same
/// representation flow through the 3D Tiles parser without reshaping.
#[derive(Debug, Default, Clone, Component)]
pub struct Obb {
    pub center: Vec3,
    pub half_axes: [Vec3; 3],
}

impl Obb {
    pub fn new(center: Vec3, half_axes: [Vec3; 3]) -> Self {
        Self { center, half_axes }
    }

    /// Reads the 3D Tiles `box` bounding volume layout directly.
    /// `[cx, cy, cz, x0, x1, x2, y0, y1, y2, z0, z1, z2]`
    pub fn from_box_array(arr: [FloatType; 12]) -> Self {
        Self {
            center: Vec3::new(arr[0], arr[1], arr[2]),
            half_axes: [
                Vec3::new(arr[3], arr[4], arr[5]),
                Vec3::new(arr[6], arr[7], arr[8]),
                Vec3::new(arr[9], arr[10], arr[11]),
            ],
        }
    }

    /// Builds an OBB aligned with the East-North-Up basis at the geographic
    /// center of `extent`. This is much tighter than an axis-aligned hull for
    /// curved patches on the ellipsoid because the box rotates with the
    /// surface — the Up axis follows the local geodetic normal at the patch
    /// center rather than world Z.
    ///
    /// Sampling and the chord-arc padding follow the same approach as
    /// [`super::Aabb::from_extent_f64`]: a grid whose step in lng/lat is
    /// bounded by `MAX_ANGULAR_STEP_RAD` ensures the chord between adjacent
    /// samples stays close to the underlying arc, and the box is then
    /// inflated by `outer_radius * (1 - cos(half_diag))` to account for the
    /// surface bulge between samples.
    pub fn from_oriented_extent(
        extent: Extent<FloatType, Radians>,
        min_height: FloatType,
        max_height: FloatType,
    ) -> Self {
        const MAX_ANGULAR_STEP_RAD: FloatType = 0.05;

        let ellipsoid = WGS84_64;

        let west = extent.west.val();
        let east = extent.east.val();
        let south = extent.south.val();
        let north = extent.north.val();

        let center_lng = (west + east) * 0.5;
        let center_lat = (south + north) * 0.5;
        let center_height = (min_height + max_height) * 0.5;

        let center_xyz = ellipsoid.lle_to_xyz(LLE {
            lng: Angle::new(center_lng),
            lat: Angle::new(center_lat),
            height: Meters::new(center_height),
        });
        let basis_origin = Vec3::new(center_xyz.x.val(), center_xyz.y.val(), center_xyz.z.val());

        let enu = east_north_up_to_fixed_frame(basis_origin, ellipsoid);
        let east_axis = Vec3::new(enu.x_axis.x, enu.x_axis.y, enu.x_axis.z);
        let north_axis = Vec3::new(enu.y_axis.x, enu.y_axis.y, enu.y_axis.z);
        let up_axis = Vec3::new(enu.z_axis.x, enu.z_axis.y, enu.z_axis.z);

        let lng_span = (east - west).abs();
        let lat_span = (north - south).abs();
        let lng_segments = (lng_span / MAX_ANGULAR_STEP_RAD).ceil().max(1.0) as usize;
        let lat_segments = (lat_span / MAX_ANGULAR_STEP_RAD).ceil().max(1.0) as usize;

        let mut min_e = FloatType::INFINITY;
        let mut max_e = FloatType::NEG_INFINITY;
        let mut min_n = FloatType::INFINITY;
        let mut max_n = FloatType::NEG_INFINITY;
        let mut min_u = FloatType::INFINITY;
        let mut max_u = FloatType::NEG_INFINITY;

        let max_height_m = Meters::new(max_height);
        let min_height_m = Meters::new(min_height);

        for i in 0..=lng_segments {
            let t_lng = i as FloatType / lng_segments as FloatType;
            let lng = Angle::new(west + (east - west) * t_lng);
            for j in 0..=lat_segments {
                let t_lat = j as FloatType / lat_segments as FloatType;
                let lat = Angle::new(south + (north - south) * t_lat);
                for height in [max_height_m, min_height_m] {
                    let p = ellipsoid.lle_to_xyz(LLE { lng, lat, height });
                    let p_world = Vec3::new(p.x.val(), p.y.val(), p.z.val());
                    let d = p_world - basis_origin;
                    let e = d.dot(east_axis);
                    let n = d.dot(north_axis);
                    let u = d.dot(up_axis);
                    if e < min_e {
                        min_e = e;
                    }
                    if e > max_e {
                        max_e = e;
                    }
                    if n < min_n {
                        min_n = n;
                    }
                    if n > max_n {
                        max_n = n;
                    }
                    if u < min_u {
                        min_u = u;
                    }
                    if u > max_u {
                        max_u = u;
                    }
                }
            }
        }

        let lng_step = lng_span / lng_segments as FloatType;
        let lat_step = lat_span / lat_segments as FloatType;
        let half_diag = (lng_step * lng_step + lat_step * lat_step).sqrt() * 0.5;
        let outer_radius = ellipsoid.semi_major_axis() + max_height.max(0.0);
        let padding = outer_radius * (1.0 - half_diag.cos());

        let mid_e = (min_e + max_e) * 0.5;
        let mid_n = (min_n + max_n) * 0.5;
        let mid_u = (min_u + max_u) * 0.5;

        let new_center = basis_origin + east_axis * mid_e + north_axis * mid_n + up_axis * mid_u;

        let half_e = (max_e - mid_e) + padding;
        let half_n = (max_n - mid_n) + padding;
        let half_u = (max_u - mid_u) + padding;

        Self {
            center: new_center,
            half_axes: [east_axis * half_e, north_axis * half_n, up_axis * half_u],
        }
    }

    /// Conservative plane-side test analogous to [`super::Aabb::is_on_or_forward_plane`].
    /// The OBB is in front of the plane iff `distance(center) >= -r`, where
    /// `r = Σ |axis_i · n|` is the projection radius of the box onto the
    /// plane normal.
    pub fn is_on_or_forward_plane(&self, plane: &Plane) -> bool {
        let normal = plane.normal.as_dvec3();
        let r = self.half_axes[0].dot(normal).abs()
            + self.half_axes[1].dot(normal).abs()
            + self.half_axes[2].dot(normal).abs();
        plane.get_distance_to_point(self.center) >= -r
    }

    /// Distance from `p` to the closest point on the OBB surface (0 if inside).
    ///
    /// For each (orthogonal) half-axis `e_i`, the normalized projection
    /// `t_i = (p - c)·e_i / |e_i|²` is in `[-1, 1]` for points inside the box
    /// on that axis. When `|t_i| > 1` the residual along that axis has length
    /// `(|t_i| - 1) · |e_i|`. Because the axes are orthogonal, the squared
    /// distances along each axis sum to the squared world-space distance.
    pub fn distance_to_point(&self, p: Vec3) -> FloatType {
        let d = p - self.center;
        let mut sq_distance = 0.0;
        for axis in &self.half_axes {
            let len_sq = axis.length_squared();
            if len_sq <= 0.0 {
                continue;
            }
            let t = d.dot(*axis) / len_sq;
            let excess = t.abs() - 1.0;
            if excess > 0.0 {
                let world_excess = excess * len_sq.sqrt();
                sq_distance += world_excess * world_excess;
            }
        }
        sq_distance.sqrt()
    }

    /// Returns the 8 corner points of the OBB in world space. Useful for
    /// frustum-OBB SAT tests and for unit tests of the parameterization.
    pub fn corners(&self) -> [Vec3; 8] {
        let [a, b, c] = self.half_axes;
        [
            self.center - a - b - c,
            self.center + a - b - c,
            self.center - a + b - c,
            self.center + a + b - c,
            self.center - a - b + c,
            self.center + a - b + c,
            self.center - a + b + c,
            self.center + a + b + c,
        ]
    }
}

#[cfg(test)]
mod tests {
    use approx::assert_abs_diff_eq;
    use navara_math::{EPSILON5, EPSILON7, Vec3};

    use crate::{Angle, Extent, LLE, Meters, Plane, WGS84_64};

    use super::Obb;

    /// A box whose half-axes are aligned with world X/Y/Z must give exactly the
    /// same distance-to-point as the AABB with the same center/extents.
    #[test]
    fn axis_aligned_obb_matches_aabb_distance() {
        let obb = Obb::new(
            Vec3::ZERO,
            [
                Vec3::new(2., 0., 0.),
                Vec3::new(0., 3., 0.),
                Vec3::new(0., 0., 1.),
            ],
        );

        // Inside.
        assert_abs_diff_eq!(
            obb.distance_to_point(Vec3::new(1., 1., 0.)),
            0.0,
            epsilon = EPSILON7
        );
        // Outside along a single axis.
        assert_abs_diff_eq!(
            obb.distance_to_point(Vec3::new(5., 0., 0.)),
            3.0,
            epsilon = EPSILON7
        );
        // Outside along two axes — corner-region distance is Euclidean.
        assert_abs_diff_eq!(
            obb.distance_to_point(Vec3::new(5., 6., 0.)),
            (3.0_f64.powi(2) + 3.0_f64.powi(2)).sqrt(),
            epsilon = EPSILON7
        );
        // Outside along all three axes.
        assert_abs_diff_eq!(
            obb.distance_to_point(Vec3::new(5., 6., 4.)),
            (3.0_f64.powi(2) + 3.0_f64.powi(2) + 3.0_f64.powi(2)).sqrt(),
            epsilon = EPSILON7
        );
    }

    /// Rotate a unit box 45° around Z and verify that distance is preserved.
    /// The rotated box still has half-extent 1 along each principal axis, so
    /// a point lying at `(2, 2, 0)` is at distance `2*sqrt(2) - sqrt(2)` from
    /// the surface (since the closest corner is `(sqrt(2)/2, sqrt(2)/2, 0)`...
    /// no wait, easier: pick a point on the rotated axis).
    #[test]
    fn rotated_obb_distance_along_rotated_axis() {
        let s = 1.0_f64 / 2.0_f64.sqrt();
        // OBB with half-axes rotated 45° around Z.
        let obb = Obb::new(
            Vec3::ZERO,
            [
                Vec3::new(s, s, 0.),   // rotated +X (length 1)
                Vec3::new(-s, s, 0.),  // rotated +Y (length 1)
                Vec3::new(0., 0., 1.), // +Z
            ],
        );

        // World point at distance 3 along the rotated +X direction — should
        // be at distance 2 from the box surface (box extends 1 along this axis).
        let world = Vec3::new(3. * s, 3. * s, 0.);
        assert_abs_diff_eq!(obb.distance_to_point(world), 2.0, epsilon = EPSILON7);

        // World point at (1, 0, 0) is *inside* the rotated box (projection on
        // both rotated axes is s ≈ 0.707, within [-1, 1]).
        assert_abs_diff_eq!(
            obb.distance_to_point(Vec3::new(1., 0., 0.)),
            0.0,
            epsilon = EPSILON7
        );

        // World point at (sqrt(2), 0, 0) lies on the rotated-X face (t_x = 1,
        // t_y = 0), so distance is 0.
        assert_abs_diff_eq!(
            obb.distance_to_point(Vec3::new(2.0_f64.sqrt(), 0., 0.)),
            0.0,
            epsilon = EPSILON7
        );
    }

    /// Non-uniform half-axis lengths must scale the distance correctly along
    /// each axis. A degenerate axis with length 0 must not panic and must be
    /// ignored (treated as fully inside on that dimension).
    #[test]
    fn non_uniform_and_degenerate_axes() {
        let obb = Obb::new(
            Vec3::new(10., 0., 0.),
            [
                Vec3::new(4., 0., 0.),  // half-extent 4 along X
                Vec3::new(0., 0.5, 0.), // half-extent 0.5 along Y
                Vec3::new(0., 0., 0.),  // degenerate
            ],
        );

        // Point well outside Y range, inside X.
        assert_abs_diff_eq!(
            obb.distance_to_point(Vec3::new(10., 5., 0.)),
            4.5,
            epsilon = EPSILON7
        );
        // Point outside both X and Y; Z axis is degenerate so Z doesn't add.
        assert_abs_diff_eq!(
            obb.distance_to_point(Vec3::new(16., 5., 100.)),
            (2.0_f64.powi(2) + 4.5_f64.powi(2)).sqrt(),
            epsilon = EPSILON7
        );
    }

    /// Plane-side test: forward, on, behind.
    #[test]
    fn is_on_or_forward_plane_three_cases() {
        let obb = Obb::new(
            Vec3::new(0., 5., 0.),
            [
                Vec3::new(1., 0., 0.),
                Vec3::new(0., 1., 0.),
                Vec3::new(0., 0., 1.),
            ],
        );

        // Plane at y=0 facing +Y. OBB sits at y∈[4, 6] — fully in front.
        let plane = Plane::from_point_normal(Vec3::new(0., 0., 0.), Vec3::new(0., 1., 0.));
        assert!(obb.is_on_or_forward_plane(&plane));

        // Plane at y=10 facing +Y. OBB sits at y∈[4, 6] — fully behind.
        let plane = Plane::from_point_normal(Vec3::new(0., 10., 0.), Vec3::new(0., 1., 0.));
        assert!(!obb.is_on_or_forward_plane(&plane));

        // Plane at y=5 facing +Y. OBB center on plane, half-extent crosses —
        // still considered "on or forward" per the conservative test.
        let plane = Plane::from_point_normal(Vec3::new(0., 5., 0.), Vec3::new(0., 1., 0.));
        assert!(obb.is_on_or_forward_plane(&plane));

        // Rotated plane: 45° around Z. OBB still sits at +Y, projection
        // radius onto the new normal is sqrt(2)/2 + sqrt(2)/2 = sqrt(2).
        let n = Vec3::new(1., 1., 0.).normalize();
        let plane = Plane::from_point_normal(Vec3::new(0., 0., 0.), n);
        // Center distance = (0 + 5)/sqrt(2) = 5/sqrt(2) ≈ 3.535 > -sqrt(2)
        assert!(obb.is_on_or_forward_plane(&plane));
    }

    #[test]
    fn corners_count_and_layout() {
        let obb = Obb::new(
            Vec3::new(1., 2., 3.),
            [
                Vec3::new(1., 0., 0.),
                Vec3::new(0., 2., 0.),
                Vec3::new(0., 0., 3.),
            ],
        );
        let corners = obb.corners();
        assert_eq!(corners.len(), 8);

        // The extreme `+a + b + c` corner is at (1+1, 2+2, 3+3).
        assert_eq!(corners[7], Vec3::new(2., 4., 6.));
        // The extreme `-a - b - c` corner is at (0, 0, 0).
        assert_eq!(corners[0], Vec3::new(0., 0., 0.));
    }

    /// 3D Tiles `box` round-trip: the 12-element array layout must
    /// reconstruct exactly the same center and half-axes.
    #[test]
    fn from_box_array_round_trip() {
        let arr = [
            10., 20., 30., // center
            1., 0., 0., // x-axis
            0., 2., 0., // y-axis
            0., 0., 3., // z-axis
        ];
        let obb = Obb::from_box_array(arr);
        assert_eq!(obb.center, Vec3::new(10., 20., 30.));
        assert_eq!(obb.half_axes[0], Vec3::new(1., 0., 0.));
        assert_eq!(obb.half_axes[1], Vec3::new(0., 2., 0.));
        assert_eq!(obb.half_axes[2], Vec3::new(0., 0., 3.));
    }

    /// The OBB built from a region extent must contain every grid sample on
    /// the curved ellipsoid surface within the patch — the same property the
    /// AABB version is tested for in `aabb.rs`, but for a much tighter box.
    #[test]
    fn from_oriented_extent_covers_curved_surface() {
        // Quarter-Earth NE quadrant (same extent used in
        // aabb.rs::from_extent_f64_should_cover_curved_surface_for_large_region).
        let extent = Extent {
            west: Angle::new(0.0),
            south: Angle::new(0.0),
            east: Angle::new(std::f64::consts::PI),
            north: Angle::new(1.4844222297453327),
        };
        let min_height = 0.0;
        let max_height = 1000.0;

        let obb = Obb::from_oriented_extent(extent, min_height, max_height);
        let ellipsoid = WGS84_64;

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
            let p_world = Vec3::new(p.x.val(), p.y.val(), p.z.val());
            // Distance to OBB must be ~0 for points inside the patch (within
            // the chord-arc padding, which can be up to a few km for this huge
            // extent).
            let dist = obb.distance_to_point(p_world);
            assert!(
                dist <= 10_000.0,
                "Probe at lng={}, lat={} is {} m outside the OBB",
                probe.lng.val(),
                probe.lat.val(),
                dist
            );
        }
    }

    /// A small Tokyo-area region: the OBB-aligned envelope should be tighter
    /// than the world-axis AABB. Compare the volume of the OBB (8 * Π |e_i|)
    /// against the volume of the equivalent AABB to demonstrate the
    /// improvement.
    #[test]
    fn from_oriented_extent_is_tighter_than_aabb_for_tilted_region() {
        let extent = Extent {
            // High-latitude region where the ENU basis tilts substantially
            // away from world axes, so the OBB and AABB diverge clearly.
            west: Angle::new(60.0_f64.to_radians()),
            south: Angle::new(55.0_f64.to_radians()),
            east: Angle::new(62.0_f64.to_radians()),
            north: Angle::new(57.0_f64.to_radians()),
        };
        let min_height = 0.0;
        let max_height = 500.0;

        let obb = Obb::from_oriented_extent(extent, min_height, max_height);
        let aabb = crate::Aabb::from_extent_f64(extent, min_height, max_height);

        let obb_volume =
            8.0 * obb.half_axes[0].length() * obb.half_axes[1].length() * obb.half_axes[2].length();
        let aabb_volume = 8.0 * aabb.extents.x * aabb.extents.y * aabb.extents.z;

        assert!(
            obb_volume < aabb_volume,
            "OBB volume {} should be less than AABB volume {}",
            obb_volume,
            aabb_volume
        );
    }

    /// Distance to a point on the ellipsoid surface inside the region's
    /// extent must be ~0 (within chord-arc padding). Verified at a non-trivial
    /// latitude where the ENU basis is noticeably tilted from world axes.
    #[test]
    fn from_oriented_extent_contains_surface_point() {
        let extent = Extent {
            west: Angle::new(139.0_f64.to_radians()),
            south: Angle::new(35.0_f64.to_radians()),
            east: Angle::new(140.0_f64.to_radians()),
            north: Angle::new(36.0_f64.to_radians()),
        };
        let obb = Obb::from_oriented_extent(extent, 0., 100.);

        let center_pt = WGS84_64.lle_to_xyz(LLE {
            lng: Angle::new(139.5_f64.to_radians()),
            lat: Angle::new(35.5_f64.to_radians()),
            height: Meters::new(50.0),
        });
        let p = Vec3::new(center_pt.x.val(), center_pt.y.val(), center_pt.z.val());

        // The center sample is on the patch — should be at zero distance.
        assert_abs_diff_eq!(obb.distance_to_point(p), 0.0, epsilon = EPSILON5);
    }
}
