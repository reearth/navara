#![doc = include_str!("../README.md")]

mod epsilon;
mod float;
mod pi;
mod transform;
mod trigonometry;
mod vertex;

pub type Transform = crate::transform::Transform;

pub use epsilon::*;
pub use float::*;
pub use pi::*;
pub use trigonometry::*;
pub use vertex::*;
