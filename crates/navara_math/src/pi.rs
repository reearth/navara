use super::{std_float, FloatType};

pub const TWO_PI: FloatType = 2. * std_float::consts::PI;

pub const PI_OVER_TWO: FloatType = std_float::consts::PI / 2.;

pub const RADIANS_PER_DEGREE: FloatType = std_float::consts::PI / 180.;

// Normalizes an angle to the range [0, 2π).
pub fn zero_to_two_pi(mut angle: FloatType) -> FloatType {
    angle %= TWO_PI;
    if angle < 0.0 {
        angle += TWO_PI;
    }
    angle
}

// Normalizes an angle to the range [-π, π].
pub fn negative_pi_to_pi(angle: FloatType) -> FloatType {
    if (-std_float::consts::PI..=std_float::consts::PI).contains(&angle) {
        return angle;
    }

    zero_to_two_pi(angle + std_float::consts::PI) - std_float::consts::PI
}
