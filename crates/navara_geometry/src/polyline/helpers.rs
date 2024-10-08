use navara_core::{Ellipsoid, EllipsoidGeodesic, LLE};
use navara_math::{Quat, Vec3, EPSILON5, PI_OVER_TWO};
use radians::{Angle, Degrees, Radians};

use crate::helpers::vec::{direction, get_position, tangent_direction};

use super::constants::{WALL_INITIAL_MAX_HEIGHT, WALL_INITIAL_MIN_HEIGHT};

pub fn compute_right_normal(
    start: &LLE<f32, Radians>,
    end: &LLE<f32, Radians>,
    max_height: f32,
    ellipsoid: Ellipsoid<f32>,
) -> Vec3 {
    let start_bottom = get_position(ellipsoid, start, 0.);
    let start_top = get_position(ellipsoid, start, max_height);
    let end_bottom = get_position(ellipsoid, end, 0.);

    let up = direction(start_top, start_bottom);
    let forward = direction(end_bottom, start_bottom);

    forward.cross(up).normalize()
}

pub fn interpolate_segment<F>(
    ellipsoid: Ellipsoid<f32>,
    start: LLE<f32, Radians>,
    end: LLE<f32, Radians>,
    min_height: f32,
    max_height: f32,
    granularity: f32,
    mut interpolated: F,
) where
    F: FnMut(Vec3, Vec3, Vec3, LLE<f32, Radians>),
{
    if granularity == 0. {
        return;
    }

    let ellipsoid_line = EllipsoidGeodesic::new(start, end, &ellipsoid);

    let surface_distance = ellipsoid_line.distance;
    if surface_distance < granularity {
        return;
    }

    let interpolated_normal = compute_right_normal(&start, &end, max_height, ellipsoid);

    let segments = (surface_distance / granularity).ceil() as usize;
    let interpoint_distance = surface_distance / segments as f32;
    let mut distance_from_start = interpoint_distance;
    let points_to_add = segments - 1;

    for _ in 0..points_to_add {
        let interpolated_cartographic =
            ellipsoid_line.interpolate_distance(&ellipsoid, distance_from_start);
        let interpolated_bottom = get_position(ellipsoid, &interpolated_cartographic, min_height);
        let interpolated_top = get_position(ellipsoid, &interpolated_cartographic, max_height);

        interpolated(
            interpolated_normal,
            interpolated_bottom,
            interpolated_top,
            interpolated_cartographic,
        );

        distance_from_start += interpoint_distance;
    }
}

const COSINE_90: f32 = 0.;
const COSINE_180: f32 = -1.;
pub fn compute_vertex_miter_normal(
    previous_bottom: Vec3,
    vertex_bottom: Vec3,
    vertex_top: Vec3,
    next_bottom: Vec3,
) -> Vec3 {
    let up = direction(vertex_top, vertex_bottom);

    let to_previous = tangent_direction(previous_bottom, vertex_bottom, up);
    let to_next = tangent_direction(next_bottom, vertex_bottom, up);

    // Check if tangents are almost opposite - if so, no need to miter.
    if (to_previous.dot(to_next) - COSINE_180).abs() <= EPSILON5 {
        return up.cross(to_previous).normalize();
    }

    let result = (to_next + to_previous).normalize();
    let forward = up.cross(result);
    if to_next.dot(forward) < COSINE_90 {
        return result * -1.;
    }

    result
}

fn miter_break_small() -> f32 {
    Angle::<f32, Degrees>::new(30.).rad().cos()
}

fn miter_break_large() -> f32 {
    Angle::<f32, Degrees>::new(150.).rad().cos()
}

// If the end normal angle is too steep compared to the direction of the line segment,
// "break" the miter by rotating the normal 90 degrees around the "up" direction at the point
// For ultra precision we would want to project into a plane, but in practice this is sufficient.
pub fn break_miter(
    end_geometry_normal: Vec3,
    start_bottom: Vec3,
    end_bottom: Vec3,
    end_top: Vec3,
) -> Option<Vec3> {
    let line_direction = direction(end_bottom, start_bottom);

    let miter_break_small = miter_break_small();
    let miter_break_large = miter_break_large();

    let dot = line_direction.dot(end_geometry_normal);
    if dot > miter_break_small || dot < miter_break_large {
        let up = direction(end_top, end_bottom);
        let angle = if dot < miter_break_large {
            PI_OVER_TWO
        } else {
            -PI_OVER_TWO
        };
        let quaternion = Quat::from_axis_angle(up, angle);
        return Some(quaternion.mul_vec3(end_geometry_normal));
    }
    None
}

pub fn adjust_height(bottom: Vec3, top: Vec3, min_height: f32, max_height: f32) -> (Vec3, Vec3) {
    let adjust_height_normal = (top - bottom).normalize();

    let distance_for_bottom = min_height - WALL_INITIAL_MIN_HEIGHT;
    let adjust_height_offset = adjust_height_normal * distance_for_bottom;
    let adjust_height_bottom = bottom + adjust_height_offset;

    let distance_for_top = max_height - WALL_INITIAL_MAX_HEIGHT;
    let adjust_height_offset = adjust_height_normal * distance_for_top;

    let adjust_height_top = top + adjust_height_offset;

    (adjust_height_bottom, adjust_height_top)
}

#[cfg(test)]
mod test {
    use std::f32::consts::PI;

    use navara_core::{LLE, WGS84_32};
    use navara_math::Vec3;

    use crate::polyline::{constants::WALL_INITIAL_MAX_HEIGHT, helpers::break_miter};

    use super::{adjust_height, compute_right_normal};

    #[test]
    fn it_should_compute_right_normal() {
        let result = compute_right_normal(
            &LLE::from_float(0., 0., 0.),
            &LLE::from_float(PI, PI, 0.),
            WALL_INITIAL_MAX_HEIGHT,
            WGS84_32,
        );
        assert_eq!(result, Vec3::new(0.0, -0.7047281, -0.70947754));

        let result = compute_right_normal(
            &LLE::from_float(PI, PI, 0.),
            &LLE::from_float(0., 0., 0.),
            WALL_INITIAL_MAX_HEIGHT,
            WGS84_32,
        );
        assert_eq!(result, Vec3::new(4.152909e-10, 0.7047281, 0.70947754));
    }

    #[test]
    fn it_should_compute_break_miter() {
        let result = break_miter(
            Vec3::new(1., 0., 0.),
            Vec3::new(1., 0., 0.),
            Vec3::new(-1., 0., 0.),
            Vec3::new(-1., 1., 0.),
        );
        assert!(result.is_some());

        let result = break_miter(
            Vec3::new(1., 0., 0.),
            Vec3::new(1., 0., 0.),
            Vec3::new(1., 0., 0.),
            Vec3::new(1., 1., 0.),
        );
        assert!(result.is_none());
    }

    #[test]
    fn it_should_adjust_height() {
        let (bottom, top) = adjust_height(Vec3::ZERO, Vec3::ONE, 0., 1.);
        assert_eq!(bottom, Vec3::ZERO);
        assert_eq!(top, Vec3::new(-575.7729, -575.7729, -575.7729));
    }
}
