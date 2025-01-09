use crate::{Angle, Extent, Meters, Radians, LLE, WGS84_32};
use navara_math::{FloatType, Vec3};

use super::Plane;

#[derive(Debug, Default, Clone)]
pub struct Aabb {
    pub center: Vec3,
    pub extents: Vec3,
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

    pub fn from_points(ps: &[f32]) -> Self {
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

    pub fn from_extent_f32(
        extent: Extent<FloatType, Radians>,
        min_height: FloatType,
        max_height: FloatType,
    ) -> Self {
        let ellipsoid = WGS84_32;

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
            height: Meters::new(max_height + min_height / 2.),
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
            .max(p_center.x.val());
        let max_y = p_nw_max
            .y
            .val()
            .max(p_ne_max.y.val())
            .max(p_se_max.y.val())
            .max(p_sw_max.y.val())
            .max(p_center.y.val());
        let max_z = p_nw_max
            .z
            .val()
            .max(p_ne_max.z.val())
            .max(p_se_max.z.val())
            .max(p_sw_max.z.val())
            .max(p_center.z.val());
        let min_x = p_nw_min
            .x
            .val()
            .min(p_ne_min.x.val())
            .min(p_se_min.x.val())
            .min(p_sw_min.x.val())
            .min(p_center.x.val());
        let min_y = p_nw_min
            .y
            .val()
            .min(p_ne_min.y.val())
            .min(p_se_min.y.val())
            .min(p_sw_min.y.val())
            .min(p_center.y.val());
        let min_z = p_nw_min
            .z
            .val()
            .min(p_ne_min.z.val())
            .min(p_se_min.z.val())
            .min(p_sw_min.z.val())
            .min(p_center.z.val());

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
        let next = Self::from_extent_f32(extent, min_height, max_height);
        self.center = next.center;
        self.extents = next.extents;
    }

    pub fn is_on_or_forward_plane(&self, plane: &Plane) -> bool {
        let r = self.extents.dot(plane.normal.abs().into());

        plane.get_distance_to_point(self.center) >= -r
    }

    pub fn distance_to_point(&self, p: Vec3) -> f32 {
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
    use navara_math::Vec3;

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
        assert_eq!(aabb.distance_to_point(point), 3.4641016);
    }
}
