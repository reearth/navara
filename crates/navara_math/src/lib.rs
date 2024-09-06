#![doc = include_str!("../README.md")]

mod float;
mod vertex;

// TODO: Support f64
pub type Transform = bevy_transform::components::Transform;

pub use float::*;
pub use vertex::*;
