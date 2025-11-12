// Ref: https://github.com/CesiumGS/cesium/blob/6c2e520420b95bcb6c8eba0f02c76347cee1dd4b/packages/engine/Source/Core/EllipsoidTangentPlane.js

use navara_math::{FloatType, Vec2, Vec3};

use crate::{ray_plane, transform::east_north_up_to_fixed_frame, Aabb, Ellipsoid, Plane, Ray};

#[derive(Debug)]
pub struct EllipsoidTangentPlane {
    origin: Vec3,
    x_axis: Vec3,
    y_axis: Vec3,
    plane: Plane,
}

impl EllipsoidTangentPlane {
    pub fn from_points(points: &[Vec3], ellipsoid: Ellipsoid<FloatType>) -> Self {
        let aabb = Aabb::from_vec3(points);
        Self::new(aabb.center, ellipsoid)
    }

    pub fn new(origin: Vec3, ellipsoid: Ellipsoid<FloatType>) -> Self {
        let origin = ellipsoid.scale_to_geodetic_surface(origin).unwrap();
        let east_north_up = east_north_up_to_fixed_frame(origin, ellipsoid);
        let x_axis = Vec3::new(
            east_north_up.x_axis.x,
            east_north_up.x_axis.y,
            east_north_up.x_axis.z,
        );
        let y_axis = Vec3::new(
            east_north_up.y_axis.x,
            east_north_up.y_axis.y,
            east_north_up.y_axis.z,
        );
        let normal = Vec3::new(
            east_north_up.z_axis.x,
            east_north_up.z_axis.y,
            east_north_up.z_axis.z,
        );
        let plane = Plane::from_point_normal(origin, normal);

        Self {
            origin,
            x_axis,
            y_axis,
            plane,
        }
    }

    pub fn project_point_onto_plane(&self, point: Vec3) -> Option<Vec2> {
        let mut ray = Ray {
            origin: point,
            direction: point.normalize(),
        };

        let mut intersection_point = ray_plane(&ray, self.plane);

        if intersection_point.is_none() {
            ray.direction *= -1.;
            intersection_point = ray_plane(&ray, self.plane);
        }

        match intersection_point {
            Some(intersection) => {
                let v = intersection - self.origin;
                let x = self.x_axis.dot(v);
                let y = self.y_axis.dot(v);

                Some(Vec2::new(x, y))
            }
            None => None,
        }
    }

    pub fn project_points_onto_plane(&self, points: &[Vec3]) -> Vec<Vec2> {
        let mut result = vec![];
        for p in points {
            let intersection_point = self.project_point_onto_plane(*p);
            if let Some(i) = intersection_point {
                result.push(i);
            }
        }
        result
    }
}

#[cfg(test)]
mod test {
    use navara_math::{Vec2, Vec3};

    use crate::{ellipsoid_tangent_plane::EllipsoidTangentPlane, UNIT_SPHERE_64};

    #[test]
    fn it_should_be_undefined_if_the_point_is_unsolvable() {
        let ellipsoid = UNIT_SPHERE_64;
        let origin = Vec3::new(1.0, 0.0, 0.0);
        let tangent_plane = EllipsoidTangentPlane::new(origin, ellipsoid);
        let positions = Vec3::new(0.0, 0.0, 1.0);
        let returned_result = tangent_plane.project_point_onto_plane(positions);
        assert!(returned_result.is_none());
    }

    #[test]
    fn it_should_be_projection_for_point() {
        let ellipsoid = UNIT_SPHERE_64;
        let origin = Vec3::new(1.0, 0.0, 0.0);
        let tangent_plane = EllipsoidTangentPlane::new(origin, ellipsoid);
        let positions = Vec3::new(1.0, 0.0, 1.0);
        let returned_result = tangent_plane.project_point_onto_plane(positions);
        assert_eq!(returned_result.unwrap(), Vec2::new(0.0, 1.0));
    }

    #[test]
    fn it_should_be_projection_for_points() {
        let ellipsoid = UNIT_SPHERE_64;
        let origin = Vec3::new(1.0, 0.0, 0.0);
        let tangent_plane = EllipsoidTangentPlane::new(origin, ellipsoid);
        let positions = &[
            Vec3::new(1.0, 0.0, 1.0),
            Vec3::new(1.0, 0.0, 0.0),
            Vec3::new(1.0, 1.0, 0.0),
        ];
        let returned_result = tangent_plane.project_points_onto_plane(positions);
        assert_eq!(
            returned_result,
            vec![
                Vec2::new(0.0, 1.0),
                Vec2::new(0.0, 0.0),
                Vec2::new(1.0, 0.0)
            ]
        );
    }
}
