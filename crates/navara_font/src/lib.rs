#![doc = include_str!("../README.md")]

pub mod atlas;
pub mod resource;
pub mod shaping;

pub use resource::{FontCache, FontEntry, GlyphMetrics, SDFAtlas};
