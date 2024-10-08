use navara_math::{EqualEpsilon, Vec3, EPSILON15};

use crate::{Plane, Ray};

pub fn ray_plane(ray: &Ray, plane: Plane) -> Option<Vec3> {
    let origin = ray.origin;
    let direction = ray.direction;
    let normal = plane.normal;

    let denominator = normal.dot(direction.into());
    if denominator.equal_epsilon(EPSILON15) {
        return None;
    }

    let t = (plane.distance - normal.dot(origin.into())) / denominator;
    if t < 0. {
        return None;
    }

    Some(origin + direction * t)
}

#[cfg(test)]
mod test {
    use navara_math::{Dir3, Vec3};

    use crate::{ray_plane, Plane, Ray};

    #[test]
    fn it_should_be_intersected_point() {
        let ray = Ray {
            origin: Vec3::new(2.0, 0.0, 0.0),
            direction: Vec3::new(-1.0, 0.0, 0.0),
        };
        let plane = Plane {
            normal: Dir3::X,
            distance: 1.,
        };

        let intersection_point = ray_plane(&ray, plane);

        assert_eq!(intersection_point.unwrap(), Vec3::X);
    }

    #[test]
    fn it_should_not_be_intersected_point() {
        let ray = Ray {
            origin: Vec3::new(2.0, 0.0, 0.0),
            direction: Vec3::new(1.0, 0.0, 0.0),
        };
        let plane = Plane {
            normal: Dir3::X,
            distance: 1.,
        };

        let intersection_point = ray_plane(&ray, plane);

        assert!(intersection_point.is_none());
    }

    #[test]
    fn it_should_be_parallel() {
        let ray = Ray {
            origin: Vec3::new(2.0, 0.0, 0.0),
            direction: Vec3::new(0.0, 1.0, 0.0),
        };
        let plane = Plane {
            normal: Dir3::X,
            distance: 1.,
        };

        let intersection_point = ray_plane(&ray, plane);

        assert!(intersection_point.is_none());
    }
}
