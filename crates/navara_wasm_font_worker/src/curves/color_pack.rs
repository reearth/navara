//! GPU-friendly serialization of a flattened color glyph.
//!
//! Mirrors the role of [`super::pack`] for outline glyphs: it takes the
//! structured output of [`super::color_extract`] and writes it into flat
//! buffers that Phase 3's shared allocator will splice into shared GPU
//! buffers.
//!
//! Layout summary (all offsets are in *element* counts of their container —
//! u32s for `headers`/`clip_records`, f32s for `paint_params`):
//!
//! ```text
//! header (12 u32 = 3 RGBA32 texels per layer)
//!     [0..6]   transform (xx yx xy yy dx dy)   — as f32 bits
//!     [6]      (kind << 16) | (blend & 0xFFFF)
//!     [7]      paint_params_offset
//!     [8]      paint_params_count
//!     [9]      clip_records_offset
//!     [10]     clip_count
//!     [11]     reserved (zero)
//!
//! paint_params (variable f32 blob; layout depends on `kind`)
//!     Solid    : rgba(4)
//!     Linear   : extend(1) num_stops(1) p0.xy(2) p1.xy(2) [stop:offset+rgba(5)]*
//!     Radial   : extend(1) num_stops(1) c0.xy(2) r0(1) c1.xy(2) r1(1) [stop(5)]*
//!     Sweep    : extend(1) num_stops(1) center.xy(2) start(1) end(1) [stop(5)]*
//!
//! clip_records (fixed 8 u32 per clip — uniform size to keep the shader loop
//! branch-free):
//!     [0]      kind (0 = Glyph, 1 = Rect)
//!     Glyph layout:
//!       [1]    gid
//!       [2..8] transform (xx yx xy yy dx dy) as f32 bits
//!     Rect layout:
//!       [1..5] min.x min.y max.x max.y as f32 bits
//!       [5..8] reserved (zero)
//! ```
//!
//! The `paint_params_offset` / `clip_records_offset` here are layer-local —
//! they index into this packed glyph's own `paint_params` / `clip_records`
//! vectors. Phase 3's shared-buffer allocator will bias them when this blob
//! is placed in the global GPU buffers (same model as
//! [`super::pack::PackedGlyph`]).

use crate::curves::color_extract::{
    BlendKind, ClipShape, ColorGlyph, ColorStop, ExtendMode, PaintKind,
};

// ---------------------------------------------------------------------------
// Layout constants (also the GPU shader contract).
// ---------------------------------------------------------------------------

pub const LAYER_HEADER_U32S: usize = 12;
pub const CLIP_RECORD_U32S: usize = 8;

/// Numeric tags for `PaintKind`. The shader switches on this in the layer
/// header's high 16 bits.
#[repr(u32)]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum PaintTag {
    Solid = 0,
    Linear = 1,
    Radial = 2,
    Sweep = 3,
}

impl PaintTag {
    pub fn from(kind: &PaintKind) -> Self {
        match kind {
            PaintKind::Solid { .. } => PaintTag::Solid,
            PaintKind::LinearGradient { .. } => PaintTag::Linear,
            PaintKind::RadialGradient { .. } => PaintTag::Radial,
            PaintKind::SweepGradient { .. } => PaintTag::Sweep,
        }
    }
}

/// Numeric tag for `ClipShape`. Glyph clips are by far the common case.
#[repr(u32)]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ClipTag {
    Glyph = 0,
    Rect = 1,
}

/// Numeric encoding for `ExtendMode`. Stored as the first f32 of the
/// gradient paint_params block (cast as float bits in the buffer but used as
/// an int in the shader).
#[repr(u32)]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ExtendTag {
    Pad = 0,
    Repeat = 1,
    Reflect = 2,
}

impl ExtendTag {
    pub fn from(mode: ExtendMode) -> Self {
        match mode {
            ExtendMode::Pad => Self::Pad,
            ExtendMode::Repeat => Self::Repeat,
            ExtendMode::Reflect => Self::Reflect,
        }
    }
}

/// Stable numeric IDs for blend modes. The fragment shader switches on this.
#[allow(missing_docs)]
#[repr(u16)]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum BlendTag {
    Clear = 0,
    Src = 1,
    Dest = 2,
    SrcOver = 3,
    DestOver = 4,
    SrcIn = 5,
    DestIn = 6,
    SrcOut = 7,
    DestOut = 8,
    SrcAtop = 9,
    DestAtop = 10,
    Xor = 11,
    Plus = 12,
    Screen = 13,
    Overlay = 14,
    Darken = 15,
    Lighten = 16,
    ColorDodge = 17,
    ColorBurn = 18,
    HardLight = 19,
    SoftLight = 20,
    Difference = 21,
    Exclusion = 22,
    Multiply = 23,
    Hue = 24,
    Saturation = 25,
    Color = 26,
    Luminosity = 27,
}

impl BlendTag {
    pub fn from(kind: BlendKind) -> Self {
        match kind {
            BlendKind::Clear => Self::Clear,
            BlendKind::Src => Self::Src,
            BlendKind::Dest => Self::Dest,
            BlendKind::SrcOver => Self::SrcOver,
            BlendKind::DestOver => Self::DestOver,
            BlendKind::SrcIn => Self::SrcIn,
            BlendKind::DestIn => Self::DestIn,
            BlendKind::SrcOut => Self::SrcOut,
            BlendKind::DestOut => Self::DestOut,
            BlendKind::SrcAtop => Self::SrcAtop,
            BlendKind::DestAtop => Self::DestAtop,
            BlendKind::Xor => Self::Xor,
            BlendKind::Plus => Self::Plus,
            BlendKind::Screen => Self::Screen,
            BlendKind::Overlay => Self::Overlay,
            BlendKind::Darken => Self::Darken,
            BlendKind::Lighten => Self::Lighten,
            BlendKind::ColorDodge => Self::ColorDodge,
            BlendKind::ColorBurn => Self::ColorBurn,
            BlendKind::HardLight => Self::HardLight,
            BlendKind::SoftLight => Self::SoftLight,
            BlendKind::Difference => Self::Difference,
            BlendKind::Exclusion => Self::Exclusion,
            BlendKind::Multiply => Self::Multiply,
            BlendKind::Hue => Self::Hue,
            BlendKind::Saturation => Self::Saturation,
            BlendKind::Color => Self::Color,
            BlendKind::Luminosity => Self::Luminosity,
        }
    }
}

// ---------------------------------------------------------------------------
// PackedColorGlyph
// ---------------------------------------------------------------------------

/// Flat-buffer form of a color glyph. Three buffers, ready to be uploaded as
/// data textures or appended to the shared GPU buffers managed by Phase 3.
#[derive(Clone, Debug, Default)]
pub struct PackedColorGlyph {
    /// Fixed-size layer records, [`LAYER_HEADER_U32S`] u32s per layer.
    pub layer_headers: Vec<u32>,
    /// Variable f32 blob for paint parameters; layout depends on the layer's
    /// `PaintTag`.
    pub paint_params: Vec<f32>,
    /// Fixed-size clip records, [`CLIP_RECORD_U32S`] u32s per clip.
    pub clip_records: Vec<u32>,
    /// Optional em-space clip box from the COLR table.
    pub clip_box: Option<([f32; 2], [f32; 2])>,
}

impl PackedColorGlyph {
    pub fn layer_count(&self) -> usize {
        self.layer_headers.len() / LAYER_HEADER_U32S
    }

    pub fn clip_count(&self) -> usize {
        self.clip_records.len() / CLIP_RECORD_U32S
    }
}

/// Serialize a `ColorGlyph` into GPU buffers.
///
/// Offsets in `layer_headers` are *glyph-local* (relative to this blob's
/// `paint_params` / `clip_records`). The shared-buffer allocator (Phase 3)
/// rebases them when this blob is appended to the global buffers.
pub fn pack_color_glyph(glyph: &ColorGlyph) -> PackedColorGlyph {
    let mut headers = Vec::with_capacity(glyph.layers.len() * LAYER_HEADER_U32S);
    let mut paint_params: Vec<f32> = Vec::new();
    let mut clip_records: Vec<u32> = Vec::new();

    for layer in &glyph.layers {
        // -- Paint params (variable size).
        let paint_offset = paint_params.len() as u32;
        encode_paint(&layer.paint, &mut paint_params);
        let paint_count = paint_params.len() as u32 - paint_offset;

        // -- Clip records (fixed CLIP_RECORD_U32S each).
        let clip_offset = (clip_records.len() / CLIP_RECORD_U32S) as u32;
        for clip in &layer.clips {
            encode_clip(clip, &mut clip_records);
        }
        let clip_count = layer.clips.len() as u32;

        // -- Layer header.
        let paint_tag = PaintTag::from(&layer.paint) as u32;
        let blend_tag = BlendTag::from(layer.blend) as u32;
        let kind_blend = (paint_tag << 16) | (blend_tag & 0xFFFF);

        for f in layer.transform {
            headers.push(f.to_bits());
        }
        headers.push(kind_blend);
        headers.push(paint_offset);
        headers.push(paint_count);
        headers.push(clip_offset);
        headers.push(clip_count);
        headers.push(0); // reserved
        debug_assert_eq!(
            headers.len() % LAYER_HEADER_U32S,
            0,
            "layer header size mismatch",
        );
    }

    PackedColorGlyph {
        layer_headers: headers,
        paint_params,
        clip_records,
        clip_box: glyph.clip_box,
    }
}

// ---------------------------------------------------------------------------
// Encoding helpers
// ---------------------------------------------------------------------------

fn encode_paint(paint: &PaintKind, out: &mut Vec<f32>) {
    match paint {
        PaintKind::Solid { rgba } => {
            out.extend_from_slice(rgba);
        }
        PaintKind::LinearGradient {
            p0,
            p1,
            stops,
            extend,
        } => {
            push_extend(*extend, out);
            push_count(stops.len(), out);
            out.extend_from_slice(p0);
            out.extend_from_slice(p1);
            push_stops(stops, out);
        }
        PaintKind::RadialGradient {
            c0,
            r0,
            c1,
            r1,
            stops,
            extend,
        } => {
            push_extend(*extend, out);
            push_count(stops.len(), out);
            out.extend_from_slice(c0);
            out.push(*r0);
            out.extend_from_slice(c1);
            out.push(*r1);
            push_stops(stops, out);
        }
        PaintKind::SweepGradient {
            center,
            start_angle,
            end_angle,
            stops,
            extend,
        } => {
            push_extend(*extend, out);
            push_count(stops.len(), out);
            out.extend_from_slice(center);
            out.push(*start_angle);
            out.push(*end_angle);
            push_stops(stops, out);
        }
    }
}

fn push_extend(extend: ExtendMode, out: &mut Vec<f32>) {
    out.push(f32::from_bits(ExtendTag::from(extend) as u32));
}

fn push_count(n: usize, out: &mut Vec<f32>) {
    out.push(f32::from_bits(n as u32));
}

fn push_stops(stops: &[ColorStop], out: &mut Vec<f32>) {
    for s in stops {
        out.push(s.offset);
        out.extend_from_slice(&s.rgba);
    }
}

fn encode_clip(clip: &ClipShape, out: &mut Vec<u32>) {
    let start = out.len();
    match clip {
        ClipShape::Glyph { gid, transform } => {
            out.push(ClipTag::Glyph as u32);
            out.push(*gid);
            for f in transform {
                out.push(f.to_bits());
            }
        }
        ClipShape::Rect { min, max } => {
            out.push(ClipTag::Rect as u32);
            out.push(min[0].to_bits());
            out.push(min[1].to_bits());
            out.push(max[0].to_bits());
            out.push(max[1].to_bits());
        }
    }
    // Pad to fixed CLIP_RECORD_U32S.
    while out.len() < start + CLIP_RECORD_U32S {
        out.push(0);
    }
    debug_assert_eq!(out.len() - start, CLIP_RECORD_U32S);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use crate::curves::color_extract::{
        BlendKind, ClipShape, ColorGlyph, ColorLayer, ColorStop, ExtendMode, PaintKind,
    };

    fn layer(paint: PaintKind, clips: Vec<ClipShape>, blend: BlendKind) -> ColorLayer {
        ColorLayer {
            clips,
            transform: [1.0, 0.0, 0.0, 1.0, 0.0, 0.0],
            paint,
            blend,
        }
    }

    #[test]
    fn solid_layer_packs_to_four_f32_params() {
        let g = ColorGlyph {
            layers: vec![layer(
                PaintKind::Solid {
                    rgba: [1.0, 0.5, 0.25, 1.0],
                },
                vec![],
                BlendKind::SrcOver,
            )],
            clip_box: None,
            units_per_em: 1000,
        };
        let p = pack_color_glyph(&g);
        assert_eq!(p.layer_count(), 1);
        assert_eq!(p.clip_count(), 0);
        // Layer header: transform[6] + (Solid<<16 | SrcOver) + offset 0 + len 4 + clip 0 + 0 + 0
        assert_eq!(p.layer_headers.len(), LAYER_HEADER_U32S);
        let kind_blend = p.layer_headers[6];
        assert_eq!(kind_blend >> 16, PaintTag::Solid as u32);
        assert_eq!(kind_blend & 0xFFFF, BlendTag::SrcOver as u32);
        assert_eq!(p.layer_headers[7], 0); // paint_offset
        assert_eq!(p.layer_headers[8], 4); // paint_count
        assert_eq!(p.paint_params, vec![1.0, 0.5, 0.25, 1.0]);
    }

    #[test]
    fn linear_gradient_packs_with_stops() {
        let stops = vec![
            ColorStop {
                offset: 0.0,
                rgba: [1.0, 0.0, 0.0, 1.0],
            },
            ColorStop {
                offset: 1.0,
                rgba: [0.0, 0.0, 1.0, 1.0],
            },
        ];
        let g = ColorGlyph {
            layers: vec![layer(
                PaintKind::LinearGradient {
                    p0: [0.0, 0.0],
                    p1: [1.0, 0.0],
                    stops,
                    extend: ExtendMode::Pad,
                },
                vec![],
                BlendKind::SrcOver,
            )],
            clip_box: None,
            units_per_em: 1000,
        };
        let p = pack_color_glyph(&g);

        // extend + count + p0(2) + p1(2) + 2 stops * 5 = 16 f32.
        let count = p.layer_headers[8];
        assert_eq!(count, 16);

        // First f32 is the extend tag, stored as float bits.
        assert_eq!(p.paint_params[0].to_bits(), ExtendTag::Pad as u32);
        // Second is the stop count.
        assert_eq!(p.paint_params[1].to_bits(), 2);
        // p0 and p1.
        assert_eq!(&p.paint_params[2..6], &[0.0, 0.0, 1.0, 0.0]);
        // Stop 0: offset, rgba.
        assert_eq!(&p.paint_params[6..11], &[0.0, 1.0, 0.0, 0.0, 1.0]);
        // Stop 1: offset, rgba.
        assert_eq!(&p.paint_params[11..16], &[1.0, 0.0, 0.0, 1.0, 1.0]);
    }

    #[test]
    fn clip_glyph_round_trips_via_records() {
        let g = ColorGlyph {
            layers: vec![layer(
                PaintKind::Solid { rgba: [0.0; 4] },
                vec![ClipShape::Glyph {
                    gid: 42,
                    transform: [2.0, 0.0, 0.0, 2.0, 0.5, 0.25],
                }],
                BlendKind::SrcOver,
            )],
            clip_box: None,
            units_per_em: 1000,
        };
        let p = pack_color_glyph(&g);
        assert_eq!(p.clip_count(), 1);
        // First u32 = tag (Glyph = 0)
        assert_eq!(p.clip_records[0], ClipTag::Glyph as u32);
        // gid
        assert_eq!(p.clip_records[1], 42);
        // transform xx
        assert_eq!(f32::from_bits(p.clip_records[2]), 2.0);
        // transform dx
        assert_eq!(f32::from_bits(p.clip_records[6]), 0.5);
        // transform dy
        assert_eq!(f32::from_bits(p.clip_records[7]), 0.25);
    }

    #[test]
    fn rect_clip_pads_to_fixed_size() {
        let g = ColorGlyph {
            layers: vec![layer(
                PaintKind::Solid { rgba: [0.0; 4] },
                vec![ClipShape::Rect {
                    min: [0.1, 0.2],
                    max: [0.8, 0.9],
                }],
                BlendKind::SrcOver,
            )],
            clip_box: None,
            units_per_em: 1000,
        };
        let p = pack_color_glyph(&g);
        assert_eq!(p.clip_count(), 1);
        assert_eq!(p.clip_records.len(), CLIP_RECORD_U32S);
        assert_eq!(p.clip_records[0], ClipTag::Rect as u32);
        assert_eq!(f32::from_bits(p.clip_records[1]), 0.1);
        assert_eq!(f32::from_bits(p.clip_records[2]), 0.2);
        assert_eq!(f32::from_bits(p.clip_records[3]), 0.8);
        assert_eq!(f32::from_bits(p.clip_records[4]), 0.9);
        // Padding zeros.
        assert_eq!(p.clip_records[5], 0);
        assert_eq!(p.clip_records[6], 0);
        assert_eq!(p.clip_records[7], 0);
    }

    #[test]
    fn multiple_layers_chain_paint_offsets() {
        let g = ColorGlyph {
            layers: vec![
                layer(
                    PaintKind::Solid { rgba: [1.0; 4] },
                    vec![],
                    BlendKind::SrcOver,
                ),
                layer(
                    PaintKind::Solid { rgba: [0.5; 4] },
                    vec![],
                    BlendKind::Multiply,
                ),
            ],
            clip_box: None,
            units_per_em: 1000,
        };
        let p = pack_color_glyph(&g);
        assert_eq!(p.layer_count(), 2);
        // 1st layer: paint_offset=0, count=4
        assert_eq!(p.layer_headers[7], 0);
        assert_eq!(p.layer_headers[8], 4);
        // 2nd layer: paint_offset=4, count=4
        let second = LAYER_HEADER_U32S;
        assert_eq!(p.layer_headers[second + 7], 4);
        assert_eq!(p.layer_headers[second + 8], 4);
        // 2nd layer blend tag
        let kb2 = p.layer_headers[second + 6];
        assert_eq!(kb2 & 0xFFFF, BlendTag::Multiply as u32);
    }
}
