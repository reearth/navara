use std::f64::consts::PI;

pub const TWO_PI: f64 = 2. * PI;

pub const PI_OVER_TWO: f64 = PI / 2.;

pub const RADIANS_PER_DEGREE: f64 = PI / 180.;

// Normalizes an angle to the range [0, 2π).
pub fn zero_to_two_pi(mut angle: f64) -> f64 {
    angle %= TWO_PI;
    if angle < 0.0 {
        angle += TWO_PI;
    }
    angle
}

// Normalizes an angle to the range [-π, π].
pub fn negative_pi_to_pi(angle: f64) -> f64 {
    if (-PI..=PI).contains(&angle) {
        return angle;
    }

    zero_to_two_pi(angle + PI) - PI
}
