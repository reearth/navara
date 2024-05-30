use bevy_ecs::component::Component;
use bevy_math::Vec3;
use navara_core::{Angle, Meters, Radians, LLE, WGS84_32};

use super::Plane;

#[derive(Debug, Default, Component)]
pub struct Aabb {
    pub center: Vec3,
    pub extents: Vec3,
}

impl Aabb {
    pub fn from_points(p1: Vec3, p2: Vec3) -> Self {
        let max = Vec3::new(p1.x.max(p2.x), p1.y.max(p2.y), p1.z.max(p2.z));
        let min = Vec3::new(p1.x.min(p2.x), p1.y.min(p2.y), p1.z.min(p2.z));

        // TODO: Calculte the center on the spherical surface.
        // It's just center between two points, not on the spherical surface.
        let center = (max + min) * 0.5;
        Self {
            center,
            extents: max - center,
        }
    }

    pub fn from_lle_f32(p1: LLE<f32, Radians>, p2: LLE<f32, Radians>) -> Self {
        let ellipsoid = WGS84_32;
        let (max_lng, max_lat) = (
            p1.lng.val().max(p2.lng.val()),
            p1.lat.val().max(p2.lat.val()),
        );
        let (min_lng, min_lat) = (
            p1.lng.val().min(p2.lng.val()),
            p1.lat.val().min(p2.lat.val()),
        );
        let (center_lng, center_lat) = ((max_lng + min_lng) / 2., (max_lat + min_lat) / 2.);
        let extents = (max_lng - center_lng, max_lat - center_lat);

        let c = ellipsoid.lle_to_xyz(LLE::<f32, Radians> {
            lng: Angle::new(center_lng),
            lat: Angle::new(center_lat),
            height: Meters::new(0.),
        });
        let e = ellipsoid.lle_to_xyz(LLE::<f32, Radians> {
            lng: Angle::new(extents.0),
            lat: Angle::new(extents.1),
            height: Meters::new(0.),
        });

        Self {
            center: Vec3::new(c.x.val(), c.y.val(), c.z.val()),
            extents: Vec3::new(e.x.val(), e.y.val(), e.z.val()),
        }
    }

    pub fn is_on_or_forward_plane(&self, plane: &Plane) -> bool {
        let r = (self.extents.x * plane.normal.x).abs()
            + (self.extents.y * plane.normal.y).abs()
            + (self.extents.z * plane.normal.z).abs();

        plane.get_distance_to_point(self.center) > -r
    }
}

#[cfg(test)]
mod test {
    use bevy_math::Vec3;

    use crate::primitives::{Aabb, Plane};

    #[test]
    fn aabb_should_on_or_forward_plane() {
        // Aabb is under the plane, and the direction of the plane is bottom
        let plane = Plane::from_point_normal(Vec3::new(0., 2., -1.), Vec3::new(0., -1., 0.));
        let aabb = Aabb::from_points(Vec3::new(-1., -1., -1.), Vec3::new(1., 1., 1.));
        debug_assert!(aabb.is_on_or_forward_plane(&plane));

        // Aabb is above the plane, and the direction of the plane is top
        let plane = Plane::from_point_normal(Vec3::new(0., 2., -1.), Vec3::new(0., 1., 0.));
        let aabb = Aabb::from_points(Vec3::new(-1., -1., -1.), Vec3::new(1., 1., 1.));
        debug_assert!(!aabb.is_on_or_forward_plane(&plane));

        // Aabb is intersecting with the plane, and the direction of the plane is top
        let plane = Plane::from_point_normal(Vec3::new(0., 1., -1.), Vec3::new(0., 1., 0.));
        let aabb = Aabb::from_points(Vec3::new(-1., -1., -1.), Vec3::new(1., 1.1, 1.));
        debug_assert!(aabb.is_on_or_forward_plane(&plane));

        // Aabb is intersecting with the plane, and the direction of the plane is back
        let plane = Plane::from_point_normal(Vec3::new(0., 0., -1.), Vec3::new(0., 0., 1.));
        let aabb = Aabb::from_points(Vec3::new(0., 0., 0.), Vec3::new(0., 0., 0.));
        debug_assert!(aabb.is_on_or_forward_plane(&plane));
        let aabb = Aabb::from_points(Vec3::new(-1., 0., -1.), Vec3::new(1., 0., 1.));
        debug_assert!(aabb.is_on_or_forward_plane(&plane));
    }
}
