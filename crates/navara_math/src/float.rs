use cfg_if::cfg_if;
use radians::Float;

cfg_if! {
    if #[cfg(all(not(feature = "use_f32"), feature = "use_f64"))] {
        pub use std::f64 as std_float;
        pub type FloatType = f64;
    } else {
        pub use std::f32 as std_float;
        pub type FloatType = f32;
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
