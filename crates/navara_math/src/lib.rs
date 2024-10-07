#![doc = include_str!("../README.md")]

mod epsilon;
mod float;
mod pi;
mod trigonometry;
mod vertex;

// TODO: Support f64
pub type Transform = bevy_transform::components::Transform;

pub use epsilon::*;
pub use float::*;
pub use pi::*;
pub use trigonometry::*;
pub use vertex::*;
