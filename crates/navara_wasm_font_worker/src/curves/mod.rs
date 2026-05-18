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
pub mod color_extract;
pub mod color_pack;
pub mod extract;
pub mod pack;

pub use bands::{BAND_COUNT_DEFAULT, Band, BandedGlyph, build_bands};
pub use color_extract::{
    BlendKind, ClipShape, ColorGlyph, ColorLayer, ColorStop, ExtendMode, PaintKind,
    extract_color_glyph,
};
pub use color_pack::{
    BlendTag, CLIP_RECORD_U32S, ClipTag, ExtendTag, LAYER_HEADER_U32S, PackedColorGlyph, PaintTag,
    pack_color_glyph,
};
pub use extract::{CUBIC_TO_QUAD_TOL, GlyphOutline, QuadCurve, extract_glyph_outline};
pub use pack::{
    CURVE_F32_COUNT, FLAG_HAS_COLOR_LAYERS, HEADER_BAND_COUNT, HEADER_BAND_CURVES_OFFSET,
    HEADER_BANDS_OFFSET, HEADER_BBOX_MAX, HEADER_BBOX_MIN, HEADER_COLOR_LAYER_COUNT,
    HEADER_COLOR_LAYER_START, HEADER_CURVES_OFFSET, HEADER_F32_COUNT, HEADER_FLAGS, PackedGlyph,
    pack_glyph,
};
