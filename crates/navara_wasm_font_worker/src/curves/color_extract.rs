//! COLRv1 paint-graph flattener.
//!
//! Replaces the tiny-skia CPU rasterizer ([`crate::color_raster`]) for the new
//! Slug-style pipeline. Instead of painting pixels, we walk the COLRv1 paint
//! tree via [`skrifa::color::ColorPainter`] and flatten each fill into a
//! [`ColorLayer`] record. The GPU then evaluates each layer in order, masking
//! by the layer's clip outline(s) and blending with the running result.
//!
//! Coordinate system: skrifa hands us values in **font units**. We carry the
//! transform stack in font-units internally (so composition arithmetic matches
//! skrifa's intent) and then convert to **em-space** at emit time:
//!
//! - Brush points and radii are divided by `units_per_em`.
//! - Layer transform translations are divided by `units_per_em`; scale
//!   components are left alone (they're dimensionless multipliers from
//!   `PaintTransform`).
//!
//! That way the GPU side speaks pure em-space, matching what
//! [`super::extract::extract_glyph_outline`] already produces for clip outlines.
//!
//! Limitations carried forward from the existing pipeline:
//! - SweepGradient is recorded faithfully but the Phase 3 shader will fall
//!   back to the first stop until a sweep implementation lands (matches the
//!   current tiny-skia behavior, which has no sweep support either).
//! - `paint_cached_color_glyph` falls through to skrifa's default
//!   re-traversal, so we always see the fully unrolled paint tree.

use skrifa::{
    GlyphId, MetadataProvider,
    color::{
        Brush, ColorGlyphFormat, ColorPainter, ColorStop as SkColorStop, CompositeMode, Extend,
        Transform,
    },
    instance::{LocationRef, Size},
    prelude::FontRef,
    raw::{TableProvider, tables::cpal::ColorRecord, types::BoundingBox},
};

// ---------------------------------------------------------------------------
// Public data model
// ---------------------------------------------------------------------------

/// Normalized color stop. RGBA channels are in linear `[0, 1]` and have not
/// been pre-multiplied — the GPU does its own multiply when compositing.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct ColorStop {
    pub offset: f32,
    pub rgba: [f32; 4],
}

/// Extension mode for gradient stops past the end of the color line.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ExtendMode {
    Pad,
    Repeat,
    Reflect,
}

/// Brush definition for a single fill. Geometric parameters are in em-space
/// (already divided by `units_per_em`).
#[derive(Clone, Debug, PartialEq)]
pub enum PaintKind {
    Solid {
        rgba: [f32; 4],
    },
    LinearGradient {
        p0: [f32; 2],
        p1: [f32; 2],
        stops: Vec<ColorStop>,
        extend: ExtendMode,
    },
    RadialGradient {
        c0: [f32; 2],
        r0: f32,
        c1: [f32; 2],
        r1: f32,
        stops: Vec<ColorStop>,
        extend: ExtendMode,
    },
    SweepGradient {
        center: [f32; 2],
        start_angle: f32,
        end_angle: f32,
        stops: Vec<ColorStop>,
        extend: ExtendMode,
    },
}

/// Porter-Duff / blend modes from the COLRv1 spec. The names mirror skrifa's
/// [`CompositeMode`] enum but are decoupled so the GPU side can have its own
/// numeric encoding without depending on the upstream variants.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum BlendKind {
    Clear,
    Src,
    Dest,
    SrcOver,
    DestOver,
    SrcIn,
    DestIn,
    SrcOut,
    DestOut,
    SrcAtop,
    DestAtop,
    Xor,
    Plus,
    Screen,
    Overlay,
    Darken,
    Lighten,
    ColorDodge,
    ColorBurn,
    HardLight,
    SoftLight,
    Difference,
    Exclusion,
    Multiply,
    Hue,
    Saturation,
    Color,
    Luminosity,
}

/// Geometric clip applied to a fill. Multiple clips on the same layer are
/// intersected (logical AND) by the GPU evaluator.
#[derive(Clone, Debug, PartialEq)]
pub enum ClipShape {
    /// Clip by the outline of glyph `gid`. The GPU dereferences the glyph's
    /// curve table; `transform` maps the clip's em-space onto the parent
    /// layer's em-space.
    Glyph { gid: u32, transform: [f32; 6] },
    /// Axis-aligned rect in em-space (after the transform has been applied).
    Rect { min: [f32; 2], max: [f32; 2] },
}

/// One emitted fill — the smallest unit the GPU pipeline consumes.
#[derive(Clone, Debug)]
pub struct ColorLayer {
    /// Active clip stack at fill time. Logical AND on the GPU; an empty list
    /// means "no clip" (full bbox).
    pub clips: Vec<ClipShape>,
    /// Maps brush-local em-space onto the root color glyph's em-space.
    /// Row-major affine: `[xx, yx, xy, yy, dx, dy]`. Apply as:
    /// `p_em = (xx*x + xy*y + dx, yx*x + yy*y + dy)`.
    pub transform: [f32; 6],
    pub paint: PaintKind,
    /// How this fill composites onto the running result (the layer immediately
    /// below it). For fills outside any `push_layer` group this is
    /// `BlendKind::SrcOver`.
    pub blend: BlendKind,
}

/// Flattened paint graph for a single COLRv1 root glyph.
#[derive(Clone, Debug)]
pub struct ColorGlyph {
    pub layers: Vec<ColorLayer>,
    /// Em-space clip box from the COLR table, if present. The GPU uses this as
    /// an early-reject bound; missing → fall back to the union of all clips.
    pub clip_box: Option<([f32; 2], [f32; 2])>,
    pub units_per_em: u16,
}

impl ColorGlyph {
    pub fn is_empty(&self) -> bool {
        self.layers.is_empty()
    }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

/// Flatten the COLRv1 paint graph for `glyph_id`.
///
/// Returns `None` when the font has no COLRv1 entry for the glyph, or when
/// `units_per_em` is zero / `head` is unreadable.
pub fn extract_color_glyph(font: &FontRef<'_>, glyph_id: GlyphId) -> Option<ColorGlyph> {
    let upem = font.head().ok()?.units_per_em();
    if upem == 0 {
        return None;
    }

    let color_glyphs = font.color_glyphs();
    let glyph = color_glyphs.get_with_format(glyph_id, ColorGlyphFormat::ColrV1)?;

    let palette: Vec<ColorRecord> = font
        .cpal()
        .ok()
        .and_then(|c| c.color_records_array())
        .and_then(|r| r.ok())
        .map(|s| s.to_vec())
        .unwrap_or_default();

    let inv_upem = 1.0 / upem as f32;
    let mut painter = Painter::new(palette, inv_upem);
    glyph.paint(LocationRef::default(), &mut painter).ok()?;

    let clip_box = glyph
        .bounding_box(LocationRef::default(), Size::unscaled())
        .map(|bb| {
            (
                [bb.x_min * inv_upem, bb.y_min * inv_upem],
                [bb.x_max * inv_upem, bb.y_max * inv_upem],
            )
        });

    Some(ColorGlyph {
        layers: painter.into_layers(),
        clip_box,
        units_per_em: upem,
    })
}

// ---------------------------------------------------------------------------
// Painter (private)
// ---------------------------------------------------------------------------

/// Per-clip record on the stack, captured at `push_clip_*` time so that any
/// subsequent `push_transform` only affects the brush, not the clip.
#[derive(Clone, Debug)]
struct ActiveClip {
    shape: ClipShape,
}

struct Painter {
    palette: Vec<ColorRecord>,
    /// Multiplier applied to translations and brush coords at emit time.
    inv_upem: f32,
    /// Transform stack in **font units** (skrifa's native space). Top is the
    /// current effective transform.
    transforms: Vec<TransformFu>,
    /// Active clips. Each `push_clip_*` appends one; each `pop_clip` removes
    /// the last one.
    clips: Vec<ActiveClip>,
    /// Composite-mode stack for `push_layer` / `pop_layer`. The first slot is
    /// always `SrcOver` so fills outside any group inherit sensible defaults.
    blend_stack: Vec<BlendKind>,
    /// Emitted layers, in draw order (bottom-up).
    layers: Vec<ColorLayer>,
}

/// 2×3 affine in font units. Stored matrix-style:
///   `[xx, yx, xy, yy, dx, dy]`
/// Multiplying by a vector `v = (x, y)` produces
///   `(xx*x + xy*y + dx, yx*x + yy*y + dy)`.
#[derive(Clone, Copy, Debug)]
struct TransformFu([f32; 6]);

impl TransformFu {
    fn identity() -> Self {
        Self([1.0, 0.0, 0.0, 1.0, 0.0, 0.0])
    }

    fn from_skrifa(t: Transform) -> Self {
        Self([t.xx, t.yx, t.xy, t.yy, t.dx, t.dy])
    }

    /// Parent ∘ child: `result(v) = parent(child(v))`. Translations of the
    /// child are scaled by the parent's linear part, matching the existing
    /// `tiny_skia::Transform::pre_concat` semantics used by `color_raster.rs`.
    fn pre_concat(&self, child: &TransformFu) -> TransformFu {
        let p = self.0;
        let c = child.0;
        TransformFu([
            p[0] * c[0] + p[2] * c[1],
            p[1] * c[0] + p[3] * c[1],
            p[0] * c[2] + p[2] * c[3],
            p[1] * c[2] + p[3] * c[3],
            p[0] * c[4] + p[2] * c[5] + p[4],
            p[1] * c[4] + p[3] * c[5] + p[5],
        ])
    }

    /// Apply to a font-unit point.
    fn apply(&self, p: [f32; 2]) -> [f32; 2] {
        let m = self.0;
        [
            m[0] * p[0] + m[2] * p[1] + m[4],
            m[1] * p[0] + m[3] * p[1] + m[5],
        ]
    }

    /// Convert to em-space layer transform: scale parts unchanged, translation
    /// divided by `units_per_em` so the result speaks em-units throughout.
    fn to_em(self, inv_upem: f32) -> [f32; 6] {
        let m = self.0;
        [m[0], m[1], m[2], m[3], m[4] * inv_upem, m[5] * inv_upem]
    }
}

impl Painter {
    fn new(palette: Vec<ColorRecord>, inv_upem: f32) -> Self {
        Self {
            palette,
            inv_upem,
            transforms: vec![TransformFu::identity()],
            clips: Vec::new(),
            blend_stack: vec![BlendKind::SrcOver],
            layers: Vec::new(),
        }
    }

    fn current_transform(&self) -> TransformFu {
        *self.transforms.last().expect("transform stack underflow")
    }

    fn current_blend(&self) -> BlendKind {
        *self.blend_stack.last().unwrap_or(&BlendKind::SrcOver)
    }

    fn into_layers(self) -> Vec<ColorLayer> {
        self.layers
    }

    fn resolve_color(&self, palette_index: u16, alpha: f32) -> [f32; 4] {
        // 0xFFFF means "foreground color" — preserved as opaque black to match
        // the existing rasterizer; downstream code can tint with the actual
        // text color later.
        let (r, g, b, a) = if palette_index == 0xFFFF {
            (0u8, 0u8, 0u8, 255u8)
        } else if let Some(c) = self.palette.get(palette_index as usize) {
            (c.red, c.green, c.blue, c.alpha)
        } else {
            (0u8, 0u8, 0u8, 255u8)
        };
        let a_final = (a as f32 / 255.0) * alpha.clamp(0.0, 1.0);
        [
            r as f32 / 255.0,
            g as f32 / 255.0,
            b as f32 / 255.0,
            a_final.clamp(0.0, 1.0),
        ]
    }

    fn convert_stops(&self, stops: &[SkColorStop]) -> Vec<ColorStop> {
        stops
            .iter()
            .map(|s| ColorStop {
                offset: s.offset,
                rgba: self.resolve_color(s.palette_index, s.alpha),
            })
            .collect()
    }

    /// Convert a font-unit point to em-space.
    fn point_em(&self, x: f32, y: f32) -> [f32; 2] {
        [x * self.inv_upem, y * self.inv_upem]
    }

    fn convert_brush(&self, brush: &Brush<'_>) -> Option<PaintKind> {
        Some(match brush {
            Brush::Solid {
                palette_index,
                alpha,
            } => PaintKind::Solid {
                rgba: self.resolve_color(*palette_index, *alpha),
            },
            Brush::LinearGradient {
                p0,
                p1,
                color_stops,
                extend,
            } => PaintKind::LinearGradient {
                p0: self.point_em(p0.x, p0.y),
                p1: self.point_em(p1.x, p1.y),
                stops: self.convert_stops(color_stops),
                extend: convert_extend(*extend),
            },
            Brush::RadialGradient {
                c0,
                r0,
                c1,
                r1,
                color_stops,
                extend,
            } => PaintKind::RadialGradient {
                c0: self.point_em(c0.x, c0.y),
                r0: r0 * self.inv_upem,
                c1: self.point_em(c1.x, c1.y),
                r1: r1 * self.inv_upem,
                stops: self.convert_stops(color_stops),
                extend: convert_extend(*extend),
            },
            Brush::SweepGradient {
                c0,
                start_angle,
                end_angle,
                color_stops,
                extend,
            } => PaintKind::SweepGradient {
                center: self.point_em(c0.x, c0.y),
                start_angle: *start_angle,
                end_angle: *end_angle,
                stops: self.convert_stops(color_stops),
                extend: convert_extend(*extend),
            },
        })
    }
}

impl ColorPainter for Painter {
    fn push_transform(&mut self, transform: Transform) {
        let child = TransformFu::from_skrifa(transform);
        let composed = self.current_transform().pre_concat(&child);
        self.transforms.push(composed);
    }

    fn pop_transform(&mut self) {
        if self.transforms.len() > 1 {
            self.transforms.pop();
        }
    }

    fn push_clip_glyph(&mut self, glyph_id: GlyphId) {
        // Bake the current font-unit transform into em-space scaled by
        // 1/upem applied to translation (matching the convention used for
        // layer transforms). The clip glyph's outline lives in em-space, so
        // the GPU side will do `p_clip_em = inv(transform_em) * p_em`.
        let transform = self.current_transform().to_em(self.inv_upem);
        self.clips.push(ActiveClip {
            shape: ClipShape::Glyph {
                gid: glyph_id.to_u32(),
                transform,
            },
        });
    }

    fn push_clip_box(&mut self, clip_box: BoundingBox<f32>) {
        // Transform the bbox corners through the current effective transform,
        // then convert to em-space. We emit an axis-aligned rect even if the
        // active transform contained rotation; this is identical to what the
        // CPU rasterizer does (`Pixmap` rects are always AABBs) and matches
        // how the COLRv1 spec defines PaintClipBox.
        let t = self.current_transform();
        let corners = [
            t.apply([clip_box.x_min, clip_box.y_min]),
            t.apply([clip_box.x_max, clip_box.y_min]),
            t.apply([clip_box.x_min, clip_box.y_max]),
            t.apply([clip_box.x_max, clip_box.y_max]),
        ];
        let mut min = [f32::INFINITY, f32::INFINITY];
        let mut max = [f32::NEG_INFINITY, f32::NEG_INFINITY];
        for c in corners {
            min[0] = min[0].min(c[0]);
            min[1] = min[1].min(c[1]);
            max[0] = max[0].max(c[0]);
            max[1] = max[1].max(c[1]);
        }
        let min_em = [min[0] * self.inv_upem, min[1] * self.inv_upem];
        let max_em = [max[0] * self.inv_upem, max[1] * self.inv_upem];
        self.clips.push(ActiveClip {
            shape: ClipShape::Rect {
                min: min_em,
                max: max_em,
            },
        });
    }

    fn pop_clip(&mut self) {
        self.clips.pop();
    }

    fn fill(&mut self, brush: Brush<'_>) {
        let Some(paint) = self.convert_brush(&brush) else {
            return;
        };
        let transform = self.current_transform().to_em(self.inv_upem);
        let clips = self.clips.iter().map(|c| c.shape.clone()).collect();
        self.layers.push(ColorLayer {
            clips,
            transform,
            paint,
            blend: self.current_blend(),
        });
    }

    fn push_layer(&mut self, composite_mode: CompositeMode) {
        self.blend_stack.push(convert_blend(composite_mode));
    }

    fn pop_layer(&mut self) {
        // Keep at least the SrcOver base.
        if self.blend_stack.len() > 1 {
            self.blend_stack.pop();
        }
    }
}

// ---------------------------------------------------------------------------
// Enum conversions
// ---------------------------------------------------------------------------

fn convert_extend(e: Extend) -> ExtendMode {
    match e {
        Extend::Pad => ExtendMode::Pad,
        Extend::Repeat => ExtendMode::Repeat,
        Extend::Reflect => ExtendMode::Reflect,
        _ => ExtendMode::Pad,
    }
}

fn convert_blend(m: CompositeMode) -> BlendKind {
    match m {
        CompositeMode::Clear => BlendKind::Clear,
        CompositeMode::Src => BlendKind::Src,
        CompositeMode::Dest => BlendKind::Dest,
        CompositeMode::SrcOver => BlendKind::SrcOver,
        CompositeMode::DestOver => BlendKind::DestOver,
        CompositeMode::SrcIn => BlendKind::SrcIn,
        CompositeMode::DestIn => BlendKind::DestIn,
        CompositeMode::SrcOut => BlendKind::SrcOut,
        CompositeMode::DestOut => BlendKind::DestOut,
        CompositeMode::SrcAtop => BlendKind::SrcAtop,
        CompositeMode::DestAtop => BlendKind::DestAtop,
        CompositeMode::Xor => BlendKind::Xor,
        CompositeMode::Plus => BlendKind::Plus,
        CompositeMode::Screen => BlendKind::Screen,
        CompositeMode::Overlay => BlendKind::Overlay,
        CompositeMode::Darken => BlendKind::Darken,
        CompositeMode::Lighten => BlendKind::Lighten,
        CompositeMode::ColorDodge => BlendKind::ColorDodge,
        CompositeMode::ColorBurn => BlendKind::ColorBurn,
        CompositeMode::HardLight => BlendKind::HardLight,
        CompositeMode::SoftLight => BlendKind::SoftLight,
        CompositeMode::Difference => BlendKind::Difference,
        CompositeMode::Exclusion => BlendKind::Exclusion,
        CompositeMode::Multiply => BlendKind::Multiply,
        CompositeMode::HslHue => BlendKind::Hue,
        CompositeMode::HslSaturation => BlendKind::Saturation,
        CompositeMode::HslColor => BlendKind::Color,
        CompositeMode::HslLuminosity => BlendKind::Luminosity,
        _ => BlendKind::SrcOver,
    }
}

// ---------------------------------------------------------------------------
// Tests (transform math + enum mapping; full extraction is covered by the
// integration test against the COLRv1 fixture).
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn identity_transform_is_neutral() {
        let p = TransformFu::identity();
        let v = p.apply([3.0, 4.0]);
        assert_eq!(v, [3.0, 4.0]);
    }

    #[test]
    fn pre_concat_matches_function_composition() {
        // parent translates by (10, 0); child scales by 2 in both axes.
        // (parent ∘ child)(v) should scale v then translate.
        let parent = TransformFu([1.0, 0.0, 0.0, 1.0, 10.0, 0.0]);
        let child = TransformFu([2.0, 0.0, 0.0, 2.0, 0.0, 0.0]);
        let composed = parent.pre_concat(&child);
        let v = composed.apply([3.0, 5.0]);
        assert_eq!(v, [16.0, 10.0]); // 2*3 + 10, 2*5
    }

    #[test]
    fn to_em_divides_only_translation() {
        // Internal: scale=2, translation=(1000, 500), upem=1000.
        let t = TransformFu([2.0, 0.0, 0.0, 2.0, 1000.0, 500.0]);
        let em = t.to_em(1.0 / 1000.0);
        assert_eq!(em, [2.0, 0.0, 0.0, 2.0, 1.0, 0.5]);
    }

    #[test]
    fn resolve_color_handles_foreground_index() {
        let painter = Painter::new(Vec::new(), 1.0 / 1000.0);
        let rgba = painter.resolve_color(0xFFFF, 1.0);
        assert_eq!(rgba, [0.0, 0.0, 0.0, 1.0]);
    }

    #[test]
    fn resolve_color_multiplies_palette_alpha_and_brush_alpha() {
        let palette = vec![ColorRecord {
            red: 255,
            green: 128,
            blue: 0,
            alpha: 128, // 50% palette alpha
        }];
        let painter = Painter::new(palette, 1.0 / 1000.0);
        let rgba = painter.resolve_color(0, 0.5); // 50% brush alpha
        assert!((rgba[0] - 1.0).abs() < 1e-4);
        assert!((rgba[1] - 128.0 / 255.0).abs() < 1e-4);
        assert!((rgba[2] - 0.0).abs() < 1e-4);
        // 128/255 (palette alpha) * 0.5 (brush alpha).
        let expected_a = (128.0 / 255.0) * 0.5;
        assert!((rgba[3] - expected_a).abs() < 1e-4);
    }

    #[test]
    fn extend_modes_map_one_to_one() {
        assert_eq!(convert_extend(Extend::Pad), ExtendMode::Pad);
        assert_eq!(convert_extend(Extend::Repeat), ExtendMode::Repeat);
        assert_eq!(convert_extend(Extend::Reflect), ExtendMode::Reflect);
    }

    #[test]
    fn pop_clip_underflow_is_safe() {
        let mut p = Painter::new(Vec::new(), 1.0 / 1000.0);
        p.pop_clip();
        p.pop_clip();
        assert!(p.clips.is_empty());
    }

    #[test]
    fn pop_transform_keeps_identity_base() {
        let mut p = Painter::new(Vec::new(), 1.0 / 1000.0);
        p.pop_transform();
        p.pop_transform();
        assert_eq!(p.transforms.len(), 1);
    }

    #[test]
    fn pop_layer_keeps_srcover_base() {
        let mut p = Painter::new(Vec::new(), 1.0 / 1000.0);
        p.pop_layer();
        p.pop_layer();
        assert_eq!(p.blend_stack.len(), 1);
        assert_eq!(p.blend_stack[0], BlendKind::SrcOver);
    }
}
