pub use radians::*;

#[derive(Copy, Clone, PartialEq, Default)]
pub struct Meters<F: Float>(F);

impl<F: Float> Meters<F> {
    pub fn new(val: F) -> Self {
        Self(val)
    }

    pub fn val(self) -> F {
        self.0
    }
}

impl<F: Float + std::fmt::Debug> std::fmt::Debug for Meters<F> {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{:?}", self.0)
    }
}

impl<F: Float + std::fmt::Display> std::fmt::Display for Meters<F> {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}m", self.0)
    }
}

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
