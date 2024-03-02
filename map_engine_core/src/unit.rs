pub use radians::*;

#[derive(Debug, Copy, Clone, PartialEq, Default)]
pub struct Meters<F: Float>(F);

impl<F: Float> Meters<F> {
    pub fn new(val: F) -> Self {
        Self(val)
    }

    pub fn val(self) -> F {
        self.0
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
