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
