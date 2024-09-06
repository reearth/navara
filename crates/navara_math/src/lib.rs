#![doc = include_str!("../README.md")]

mod coord;
mod float;
mod vertex;

// TODO: Support f64
pub type Transform = bevy_transform::components::Transform;

pub use coord::*;
pub use float::*;
pub use vertex::*;
