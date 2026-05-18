//! GPU-direct glyph outline pipeline (Slug-style).
//!
//! Replaces the SDF rasterizer for monochrome glyphs. Outlines are extracted
//! from the font once at cache time, all curves are normalized to quadratic
//! Beziers in em-space, sliced into horizontal bands, and packed into flat
//! GPU-friendly buffers. The fragment shader later ray-casts per pixel against
//! the curves of the band the pixel falls into.
//!
//! Em-space convention: all coordinates produced here are divided by the
//! font's `units_per_em` so the GPU side is font-agnostic. A glyph's bbox
//! therefore lives roughly inside [-0.5, 1.5]^2 (ascenders + descenders may
//! slightly exceed [0, 1]).
//!
//! Module split:
//! - [`extract`] — pull outlines from `skrifa`, convert lines/cubics to quads
//! - [`bands`]   — slice each glyph into N horizontal bands
//! - [`pack`]    — flatten a banded glyph into f32/u32 buffers ready for upload

pub mod bands;
pub mod extract;
pub mod pack;

pub use bands::{BAND_COUNT_DEFAULT, Band, BandedGlyph, build_bands};
pub use extract::{CUBIC_TO_QUAD_TOL, GlyphOutline, QuadCurve, extract_glyph_outline};
pub use pack::{PackedGlyph, pack_glyph};
