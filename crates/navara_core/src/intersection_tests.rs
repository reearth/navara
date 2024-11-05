use navara_math::{EqualEpsilon, FloatType, Vec3, EPSILON15};

use crate::{Ellipsoid, Plane, Ray};

/// Intersection by Ray.
pub struct Intersection {
    /// A distance for first intersected point.
    pub start: FloatType,
    /// A distance for second intersected point.
    pub end: FloatType,
}

// Ref: https://github.com/CesiumGS/cesium/blob/0e9a425b475cd3cfdd90f35e9cdbdda453e448d8/packages/engine/Source/Core/IntersectionTests.js#L28
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

// Ref: https://github.com/CesiumGS/cesium/blob/0e9a425b475cd3cfdd90f35e9cdbdda453e448d8/packages/engine/Source/Core/IntersectionTests.js#L421
pub fn ray_ellipsoid(ray: &Ray, ellipsoid: Ellipsoid<FloatType>) -> Option<Intersection> {
    let inverse_radii = Vec3::from_array(ellipsoid.one_over_radii);
    let q = inverse_radii * ray.origin;
    let w = inverse_radii * ray.direction;

    let q2 = q.length_squared();
    let qw = q.dot(w);

    let difference;
    let w2;
    let product;
    let discriminant;
    let temp;

    if q2 > 1.0 {
        // Outside ellipsoid.
        if qw >= 0.0 {
            // Looking outward or tangent (0 intersections).
            return None;
        }

        // qw < 0.0.
        let qw2 = qw * qw;
        difference = q2 - 1.0; // Positively valued.
        w2 = w.length_squared();
        product = w2 * difference;

        if qw2 < product {
            // Imaginary roots (0 intersections).
            return None;
        } else if qw2 > product {
            // Distinct roots (2 intersections).
            discriminant = qw * qw - product;
            temp = -qw + discriminant.sqrt(); // Avoid cancellation.
            let root0 = temp / w2;
            let root1 = difference / temp;
            if root0 < root1 {
                return Some(Intersection {
                    start: root0,
                    end: root1,
                });
            }

            return Some(Intersection {
                start: root1,
                end: root0,
            });
        }
        // qw2 == product.  Repeated roots (2 intersections).
        let root = (difference / w2).sqrt();
        return Some(Intersection {
            start: root,
            end: root,
        });
    } else if q2 < 1.0 {
        // Inside ellipsoid (2 intersections).
        difference = q2 - 1.0; // Negatively valued.
        w2 = w.length_squared();
        product = w2 * difference; // Negatively valued.

        discriminant = qw * qw - product;
        temp = -qw + discriminant.sqrt(); // Positively valued.
        return Some(Intersection {
            start: 0.0,
            end: temp / w2,
        });
    }
    // q2 == 1.0. On ellipsoid.
    if qw < 0.0 {
        // Looking inward.
        w2 = w.length_squared();
        return Some(Intersection {
            start: 0.0,
            end: -qw / w2,
        });
    }

    // qw >= 0.0.  Looking outward or tangent.
    None
}

#[cfg(test)]
mod test {
    use approx::assert_abs_diff_eq;
    use navara_math::{Dir3, Vec3, EPSILON14};

    use crate::{ray_plane, Plane, Ray, UNIT_SPHERE_32};

    use super::ray_ellipsoid;

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

    #[test]
    fn it_should_intersect_with_ellipsoid() {
        let result = ray_ellipsoid(
            &Ray {
                origin: Vec3::new(2., 0., 0.),
                direction: Vec3::new(-1., 0., 0.),
            },
            UNIT_SPHERE_32,
        );
        assert_abs_diff_eq!(result.as_ref().unwrap().start, 1.0, epsilon = EPSILON14);
        assert_abs_diff_eq!(result.unwrap().end, 3.0, epsilon = EPSILON14);

        let result = ray_ellipsoid(
            &Ray {
                origin: Vec3::new(1., 1., 0.),
                direction: Vec3::new(-1., 0., 0.),
            },
            UNIT_SPHERE_32,
        );
        assert_abs_diff_eq!(result.as_ref().unwrap().start, 1.0, epsilon = EPSILON14);
        assert_abs_diff_eq!(result.unwrap().end, 1.0, epsilon = EPSILON14);

        let result = ray_ellipsoid(
            &Ray {
                origin: Vec3::new(0., -2., 0.),
                direction: Vec3::new(0., 1., 0.),
            },
            UNIT_SPHERE_32,
        );
        assert_abs_diff_eq!(result.as_ref().unwrap().start, 1.0, epsilon = EPSILON14);
        assert_abs_diff_eq!(result.unwrap().end, 3.0, epsilon = EPSILON14);

        let result = ray_ellipsoid(
            &Ray {
                origin: Vec3::new(0., -2., 0.),
                direction: Vec3::new(0., -1., 0.),
            },
            UNIT_SPHERE_32,
        );
        assert!(result.is_none());
    }
}
