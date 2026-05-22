use bevy_ecs::component::Component;
use navara_math::{FloatType, Vec3};

use crate::{Aabb, BoundingSphere, Obb, Plane};

/// A tile bounding volume that can be axis-aligned (`Aabb`), oriented
/// (`Obb`), or a sphere (`Sphere`). 3D Tiles ships all three (`region`/`box`
/// → Obb, `sphere` → Sphere; the legacy Aabb variant is kept for callers
/// that already produce one), so consumers must dispatch on the variant
/// when computing frustum culling or distance metrics.
#[derive(Debug, Clone, Component)]
pub enum BoundingVolume {
    Aabb(Aabb),
    Obb(Obb),
    Sphere(BoundingSphere),
}

impl BoundingVolume {
    /// The center of the bounding volume in world space.
    pub fn center(&self) -> Vec3 {
        match self {
            BoundingVolume::Aabb(aabb) => aabb.center,
            BoundingVolume::Obb(obb) => obb.center,
            BoundingVolume::Sphere(sphere) => sphere.center,
        }
    }

    /// Distance from `p` to the closest point on the volume surface (0 if inside).
    pub fn distance_to_point(&self, p: Vec3) -> FloatType {
        match self {
            BoundingVolume::Aabb(aabb) => aabb.distance_to_point(p),
            BoundingVolume::Obb(obb) => obb.distance_to_point(p),
            BoundingVolume::Sphere(sphere) => sphere.distance_to_point(p),
        }
    }

    /// Conservative plane-side test: returns true if any part of the volume
    /// is on the plane's forward (normal) side.
    pub fn is_on_or_forward_plane(&self, plane: &Plane) -> bool {
        match self {
            BoundingVolume::Aabb(aabb) => aabb.is_on_or_forward_plane(plane),
            BoundingVolume::Obb(obb) => obb.is_on_or_forward_plane(plane),
            BoundingVolume::Sphere(sphere) => sphere.is_on_or_forward_plane(plane),
        }
    }
}

impl From<Aabb> for BoundingVolume {
    fn from(value: Aabb) -> Self {
        BoundingVolume::Aabb(value)
    }
}

impl From<Obb> for BoundingVolume {
    fn from(value: Obb) -> Self {
        BoundingVolume::Obb(value)
    }
}

impl From<BoundingSphere> for BoundingVolume {
    fn from(value: BoundingSphere) -> Self {
        BoundingVolume::Sphere(value)
    }
}

#[cfg(test)]
mod tests {
    use approx::assert_abs_diff_eq;
    use navara_math::{EPSILON7, Vec3};

    use crate::{Aabb, BoundingSphere, Obb, Plane};

    use super::BoundingVolume;

    /// Each variant must delegate `distance_to_point` to its underlying type
    /// and return the same value the underlying type would.
    #[test]
    fn variants_delegate_distance_to_point() {
        let aabb = Aabb {
            center: Vec3::ZERO,
            extents: Vec3::new(1., 1., 1.),
        };
        let bv: BoundingVolume = aabb.clone().into();

        let probe = Vec3::new(3., 0., 0.);
        assert_abs_diff_eq!(
            bv.distance_to_point(probe),
            aabb.distance_to_point(probe),
            epsilon = EPSILON7
        );

        let obb = Obb::new(
            Vec3::ZERO,
            [
                Vec3::new(1., 0., 0.),
                Vec3::new(0., 1., 0.),
                Vec3::new(0., 0., 1.),
            ],
        );
        let bv: BoundingVolume = obb.clone().into();
        assert_abs_diff_eq!(
            bv.distance_to_point(probe),
            obb.distance_to_point(probe),
            epsilon = EPSILON7
        );

        let sphere = BoundingSphere::new(Vec3::ZERO, 1.0);
        let bv: BoundingVolume = sphere.into();
        assert_abs_diff_eq!(
            bv.distance_to_point(probe),
            sphere.distance_to_point(probe),
            epsilon = EPSILON7
        );
    }

    /// Same delegation property for the plane-side test, all three variants.
    #[test]
    fn variants_delegate_is_on_or_forward_plane() {
        let plane = Plane::from_point_normal(Vec3::new(0., 5., 0.), Vec3::new(0., 1., 0.));

        let aabb = Aabb {
            center: Vec3::new(0., 0., 0.),
            extents: Vec3::new(1., 1., 1.),
        };
        let bv_aabb: BoundingVolume = aabb.clone().into();
        assert_eq!(
            bv_aabb.is_on_or_forward_plane(&plane),
            aabb.is_on_or_forward_plane(&plane)
        );

        let obb = Obb::new(
            Vec3::new(0., 10., 0.),
            [
                Vec3::new(1., 0., 0.),
                Vec3::new(0., 1., 0.),
                Vec3::new(0., 0., 1.),
            ],
        );
        let bv_obb: BoundingVolume = obb.clone().into();
        assert_eq!(
            bv_obb.is_on_or_forward_plane(&plane),
            obb.is_on_or_forward_plane(&plane)
        );

        let sphere = BoundingSphere::new(Vec3::new(0., 7., 0.), 2.0);
        let bv_sphere: BoundingVolume = sphere.into();
        assert_eq!(
            bv_sphere.is_on_or_forward_plane(&plane),
            sphere.is_on_or_forward_plane(&plane)
        );
    }

    #[test]
    fn center_returns_underlying_center() {
        let aabb = Aabb {
            center: Vec3::new(1., 2., 3.),
            extents: Vec3::new(0.5, 0.5, 0.5),
        };
        let bv: BoundingVolume = aabb.into();
        assert_eq!(bv.center(), Vec3::new(1., 2., 3.));

        let obb = Obb::new(
            Vec3::new(4., 5., 6.),
            [
                Vec3::new(1., 0., 0.),
                Vec3::new(0., 1., 0.),
                Vec3::new(0., 0., 1.),
            ],
        );
        let bv: BoundingVolume = obb.into();
        assert_eq!(bv.center(), Vec3::new(4., 5., 6.));

        let sphere = BoundingSphere::new(Vec3::new(7., 8., 9.), 1.5);
        let bv: BoundingVolume = sphere.into();
        assert_eq!(bv.center(), Vec3::new(7., 8., 9.));
    }
}
