use radians::Float;

/// DEPRECATED
/// TODO: Remove this
pub type FloatType = f64;

pub trait One<F: Float> {
    fn one() -> F;
}

impl One<f32> for f32 {
    fn one() -> f32 {
        1.0
    }
}

impl One<f64> for f64 {
    fn one() -> f64 {
        1.0
    }
}

pub trait Two<F: Float> {
    fn two() -> F;
}

impl Two<f32> for f32 {
    fn two() -> f32 {
        2.0
    }
}

impl Two<f64> for f64 {
    fn two() -> f64 {
        2.0
    }
}
