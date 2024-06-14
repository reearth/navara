use bevy_ecs::component::Component;
use bevy_math::Vec3;
use navara_core::{Angle, Extent, LngLat, Radians, WGS84_32};

use super::Plane;

#[derive(Debug, Default, Component)]
pub struct Aabb {
    pub center: Vec3,
    pub extents: Vec3,
}

impl Aabb {
    #[allow(unused)]
    pub fn from_points(p1: Vec3, p2: Vec3) -> Self {
        let max = Vec3::new(p1.x.max(p2.x), p1.y.max(p2.y), p1.z.max(p2.z));
        let min = Vec3::new(p1.x.min(p2.x), p1.y.min(p2.y), p1.z.min(p2.z));

        // It's just center between two points, not on the spherical surface.
        let center = (max + min) * 0.5;
        let extents = max - center;
        Self { center, extents }
    }

    pub fn from_extent_f32(extent: Extent<f32, Radians>) -> Self {
        let ellipsoid = WGS84_32;

        let nw = LngLat {
            lng: extent.west,
            lat: extent.north,
        };
        let ne = LngLat {
            lng: extent.east,
            lat: extent.north,
        };
        let se = LngLat {
            lng: extent.east,
            lat: extent.south,
        };
        let sw = LngLat {
            lng: extent.west,
            lat: extent.south,
        };

        let center = LngLat {
            lng: Angle::new((sw.lng.val() + ne.lng.val()) / 2.),
            lat: Angle::new((sw.lat.val() + ne.lat.val()) / 2.),
        };

        let p_nw = ellipsoid.lle_to_xyz(nw.into());
        let p_ne = ellipsoid.lle_to_xyz(ne.into());
        let p_se = ellipsoid.lle_to_xyz(se.into());
        let p_sw = ellipsoid.lle_to_xyz(sw.into());

        let p_center = ellipsoid.lle_to_xyz(center.into());

        let max_x = p_nw
            .x
            .val()
            .max(p_ne.x.val())
            .max(p_se.x.val())
            .max(p_sw.x.val())
            .max(p_center.x.val());
        let max_y = p_nw
            .y
            .val()
            .max(p_ne.y.val())
            .max(p_se.y.val())
            .max(p_sw.y.val())
            .max(p_center.y.val());
        let max_z = p_nw
            .z
            .val()
            .max(p_ne.z.val())
            .max(p_se.z.val())
            .max(p_sw.z.val())
            .max(p_center.z.val());
        let min_x = p_nw
            .x
            .val()
            .min(p_ne.x.val())
            .min(p_se.x.val())
            .min(p_sw.x.val())
            .min(p_center.x.val());
        let min_y = p_nw
            .y
            .val()
            .min(p_ne.y.val())
            .min(p_se.y.val())
            .min(p_sw.y.val())
            .min(p_center.y.val());
        let min_z = p_nw
            .z
            .val()
            .min(p_ne.z.val())
            .min(p_se.z.val())
            .min(p_sw.z.val())
            .min(p_center.z.val());

        let center = Vec3::new(
            (max_x + min_x) / 2.,
            (max_y + min_y) / 2.,
            (max_z + min_z) / 2.,
        );
        let extents = Vec3::new(max_x - center.x, max_y - center.y, max_z - center.z);

        Self { center, extents }
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
