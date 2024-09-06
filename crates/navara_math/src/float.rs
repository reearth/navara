use cfg_if::cfg_if;

cfg_if! {
    if #[cfg(all(not(feature = "use_f32"), feature = "use_f64"))] {
        pub use std::f64 as std_float;
        pub type FloatType = f64;
    } else {
        pub use std::f32 as std_float;
        pub type FloatType = f32;
    }
}
