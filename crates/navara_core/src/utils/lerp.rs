use navara_math::{std_float::consts::PI, FloatType, One, EPSILON10, TWO_PI};

use crate::Float;

pub fn lerp<F: Float + One<F>>(a: F, b: F, t: F) -> F {
    (F::one() - t) * a + t * b
}

// ref: https://github.com/CesiumGS/cesium/blob/fb314464d211abf51649b17151137db7a403502a/packages/engine/Source/Scene/CameraFlightPath.js#L128
pub fn adjust_angle_for_lerp(start_angle: FloatType, end_angle: FloatType) -> FloatType {
    let mut start_angle = start_angle;
    if (start_angle - TWO_PI.to_degrees()).abs() < EPSILON10 {
        start_angle = 0.;
    }

    if end_angle > start_angle + PI.to_degrees() {
        start_angle += TWO_PI.to_degrees();
    } else if end_angle < start_angle - PI.to_degrees() {
        start_angle -= TWO_PI.to_degrees();
    }

    start_angle
}

#[cfg(test)]
mod test {
    use crate::utils::lerp::lerp;

    #[test]
    fn test_lerp() {
        debug_assert_eq!(lerp(10., 2., 0.3), 7.6);
    }
}
