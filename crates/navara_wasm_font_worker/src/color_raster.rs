//! COLRv1 color glyph rasterizer.
//!
//! Walks a font's COLRv1 paint graph for a single glyph and produces an
//! unpremultiplied RGBA bitmap. The COLR painter operates in font units; this
//! module applies a canvas transform so geometry lands inside the target pixmap.
//!
//! Sweep gradients are not supported by `tiny-skia` and are approximated with
//! the first color stop. Other paint types (solid, linear, radial, transforms,
//! composite layers, glyph clips) are fully supported.

use skrifa::{
    GlyphId, MetadataProvider,
    color::{Brush, ColorGlyphFormat, ColorPainter, ColorStop, CompositeMode, Extend, Transform},
    instance::{LocationRef, Size},
    outline::{DrawSettings, OutlinePen},
    raw::{TableProvider, tables::cpal::ColorRecord, types::BoundingBox},
    prelude::FontRef,
};
use tiny_skia::{
    BlendMode, Color as TsColor, FillRule, GradientStop, LinearGradient, Mask, Paint, Path,
    PathBuilder, Pixmap, PixmapPaint, Point as TsPoint, RadialGradient, Shader, SpreadMode,
    Transform as TsTransform,
};

/// Pixel size at which color glyphs are rasterized into the atlas.
pub const COLOR_GLYPH_PX_SIZE: f32 = 128.0;

/// Padding (in pixels) added around the glyph bbox for antialiased edges.
const COLOR_GLYPH_PADDING: f32 = 1.0;

/// Output of rasterizing one color glyph.
pub struct ColorBitmap {
    pub width: u32,
    pub height: u32,
    /// Unpremultiplied RGBA8, row-major, origin top-left.
    pub rgba: Vec<u8>,
    /// Horizontal offset from the cursor to the glyph's left edge, in pixels.
    pub bearing_x: f32,
    /// Vertical offset from the baseline to the glyph's bottom edge, in pixels
    /// (positive = above baseline). Matches the convention used by fontdue's
    /// `Metrics::ymin` so SDF and color glyphs can share placement code.
    pub bearing_y: f32,
}

/// Rasterize a single COLRv1 color glyph at `target_px` size.
///
/// Returns `None` if the font has no COLRv1 entry for `glyph_id`, the font
/// fails to parse, or rasterization fails.
pub fn rasterize_color_glyph(
    font_data: &[u8],
    glyph_id: u32,
    target_px: f32,
) -> Option<ColorBitmap> {
    let font = FontRef::new(font_data).ok()?;
    let upem = font.head().ok()?.units_per_em() as f32;
    if upem <= 0.0 {
        return None;
    }
    let scale = target_px / upem;

    let gid = GlyphId::new(glyph_id);
    let color_glyphs = font.color_glyphs();
    let glyph = color_glyphs.get_with_format(gid, ColorGlyphFormat::ColrV1)?;

    let bbox_fu = glyph
        .bounding_box(LocationRef::default(), Size::unscaled())
        .unwrap_or_else(|| font_bbox(&font, upem));

    let pad = COLOR_GLYPH_PADDING;
    let pixel_w = ((bbox_fu.x_max - bbox_fu.x_min) * scale + 2.0 * pad)
        .ceil()
        .max(1.0) as u32;
    let pixel_h = ((bbox_fu.y_max - bbox_fu.y_min) * scale + 2.0 * pad)
        .ceil()
        .max(1.0) as u32;

    let mut canvas = Pixmap::new(pixel_w, pixel_h)?;
    canvas.fill(TsColor::TRANSPARENT);

    // font-units → pixels, flipped Y, shifted so the bbox sits inside the pixmap.
    //   x_px = (x_fu - x_min) * scale + pad
    //   y_px = (y_max - y_fu) * scale + pad
    let base_transform = TsTransform::from_row(
        scale,
        0.0,
        0.0,
        -scale,
        -bbox_fu.x_min * scale + pad,
        bbox_fu.y_max * scale + pad,
    );

    let palette: Vec<ColorRecord> = font
        .cpal()
        .ok()
        .and_then(|c| c.color_records_array())
        .and_then(|r| r.ok())
        .map(|s| s.to_vec())
        .unwrap_or_default();

    let mut painter = ColorPainterImpl::new(canvas, &font, palette, base_transform, pixel_w, pixel_h);
    glyph.paint(LocationRef::default(), &mut painter).ok()?;
    let canvas = painter.into_pixmap();

    // tiny-skia stores premultiplied; demultiply for the texture upload path.
    let rgba: Vec<u8> = canvas
        .pixels()
        .iter()
        .flat_map(|p| {
            let c = p.demultiply();
            [c.red(), c.green(), c.blue(), c.alpha()]
        })
        .collect();

    Some(ColorBitmap {
        width: pixel_w,
        height: pixel_h,
        rgba,
        bearing_x: bbox_fu.x_min * scale - pad,
        bearing_y: bbox_fu.y_min * scale - pad,
    })
}

/// Generous fallback bbox used when a COLRv1 glyph has no ClipBox.
fn font_bbox(font: &FontRef<'_>, upem: f32) -> BoundingBox<f32> {
    if let Ok(head) = font.head() {
        BoundingBox {
            x_min: head.x_min() as f32,
            y_min: head.y_min() as f32,
            x_max: head.x_max() as f32,
            y_max: head.y_max() as f32,
        }
    } else {
        BoundingBox {
            x_min: 0.0,
            y_min: 0.0,
            x_max: upem,
            y_max: upem,
        }
    }
}

// ---------------------------------------------------------------------------
// Path building from skrifa outlines
// ---------------------------------------------------------------------------

struct PathBuilderPen {
    builder: PathBuilder,
    started: bool,
}

impl PathBuilderPen {
    fn new() -> Self {
        Self {
            builder: PathBuilder::new(),
            started: false,
        }
    }
    fn finish(self) -> Option<Path> {
        self.builder.finish()
    }
}

impl OutlinePen for PathBuilderPen {
    fn move_to(&mut self, x: f32, y: f32) {
        self.builder.move_to(x, y);
        self.started = true;
    }
    fn line_to(&mut self, x: f32, y: f32) {
        if self.started {
            self.builder.line_to(x, y);
        }
    }
    fn quad_to(&mut self, cx0: f32, cy0: f32, x: f32, y: f32) {
        if self.started {
            self.builder.quad_to(cx0, cy0, x, y);
        }
    }
    fn curve_to(&mut self, cx0: f32, cy0: f32, cx1: f32, cy1: f32, x: f32, y: f32) {
        if self.started {
            self.builder.cubic_to(cx0, cy0, cx1, cy1, x, y);
        }
    }
    fn close(&mut self) {
        if self.started {
            self.builder.close();
        }
    }
}

fn glyph_path(font: &FontRef<'_>, glyph_id: GlyphId) -> Option<Path> {
    let outlines = font.outline_glyphs();
    let outline = outlines.get(glyph_id)?;
    let mut pen = PathBuilderPen::new();
    outline
        .draw(
            DrawSettings::unhinted(Size::unscaled(), LocationRef::default()),
            &mut pen,
        )
        .ok()?;
    pen.finish()
}

// ---------------------------------------------------------------------------
// ColorPainter implementation
// ---------------------------------------------------------------------------

struct Layer {
    pixmap: Pixmap,
    mode: CompositeMode,
}

struct ColorPainterImpl<'a> {
    canvas: Pixmap,
    font: &'a FontRef<'a>,
    palette: Vec<ColorRecord>,
    /// Transform stack; top is the current effective transform.
    transforms: Vec<TsTransform>,
    /// Clip stack; `None` means no clip. Each push intersects with the previous.
    clip_stack: Vec<Option<Mask>>,
    /// Layer stack; fills go to the top-most layer when non-empty.
    layers: Vec<Layer>,
    width: u32,
    height: u32,
}

impl<'a> ColorPainterImpl<'a> {
    fn new(
        canvas: Pixmap,
        font: &'a FontRef<'a>,
        palette: Vec<ColorRecord>,
        base: TsTransform,
        width: u32,
        height: u32,
    ) -> Self {
        Self {
            canvas,
            font,
            palette,
            transforms: vec![base],
            clip_stack: vec![None],
            layers: Vec::new(),
            width,
            height,
        }
    }

    fn into_pixmap(self) -> Pixmap {
        self.canvas
    }

    fn current_transform(&self) -> TsTransform {
        *self.transforms.last().expect("transform stack underflow")
    }

    fn current_clip(&self) -> Option<&Mask> {
        self.clip_stack.last().and_then(|m| m.as_ref())
    }

    fn target_pixmap(&mut self) -> &mut Pixmap {
        if let Some(layer) = self.layers.last_mut() {
            &mut layer.pixmap
        } else {
            &mut self.canvas
        }
    }

    fn resolve_color(&self, palette_index: u16, alpha: f32) -> TsColor {
        // 0xFFFF means "foreground color" — for atlas baking we use opaque black;
        // emoji glyphs rarely use foreground, and the consumer can tint later.
        let (r, g, b, a) = if palette_index == 0xFFFF {
            (0u8, 0u8, 0u8, 255u8)
        } else if let Some(c) = self.palette.get(palette_index as usize) {
            (c.red, c.green, c.blue, c.alpha)
        } else {
            (0u8, 0u8, 0u8, 255u8)
        };
        let a_final = (a as f32 / 255.0) * alpha.clamp(0.0, 1.0);
        TsColor::from_rgba(
            r as f32 / 255.0,
            g as f32 / 255.0,
            b as f32 / 255.0,
            a_final.clamp(0.0, 1.0),
        )
        .unwrap_or(TsColor::TRANSPARENT)
    }

    /// Build a tiny-skia shader from a COLR brush.
    ///
    /// `local_transform` maps the brush's local coordinate space (font units,
    /// composed with any active PaintTransforms) into destination pixel space.
    /// For gradients we pass it as the shader's local transform so endpoints
    /// land at the right canvas pixels.
    fn brush_to_shader(
        &self,
        brush: &Brush<'_>,
        local_transform: TsTransform,
    ) -> Option<Shader<'static>> {
        match brush {
            Brush::Solid {
                palette_index,
                alpha,
            } => Some(Shader::SolidColor(
                self.resolve_color(*palette_index, *alpha),
            )),
            Brush::LinearGradient {
                p0,
                p1,
                color_stops,
                extend,
            } => {
                let stops = self.gradient_stops(color_stops);
                LinearGradient::new(
                    TsPoint::from_xy(p0.x, p0.y),
                    TsPoint::from_xy(p1.x, p1.y),
                    stops,
                    extend_to_spread(*extend),
                    local_transform,
                )
            }
            Brush::RadialGradient {
                c0,
                r0,
                c1,
                r1,
                color_stops,
                extend,
            } => {
                let stops = self.gradient_stops(color_stops);
                RadialGradient::new(
                    TsPoint::from_xy(c0.x, c0.y),
                    (*r0).max(0.0),
                    TsPoint::from_xy(c1.x, c1.y),
                    (*r1).max(0.0),
                    stops,
                    extend_to_spread(*extend),
                    local_transform,
                )
            }
            Brush::SweepGradient { color_stops, .. } => {
                // tiny-skia 0.12 has no sweep/conical gradient.
                // Approximate with the first color stop until we add a custom shader.
                color_stops.first().map(|s| {
                    Shader::SolidColor(self.resolve_color(s.palette_index, s.alpha))
                })
            }
        }
    }

    fn gradient_stops(&self, stops: &[ColorStop]) -> Vec<GradientStop> {
        stops
            .iter()
            .map(|s| GradientStop::new(s.offset, self.resolve_color(s.palette_index, s.alpha)))
            .collect()
    }

    /// Fill the current clip area (whatever the mask defines) with `brush`.
    ///
    /// The clip mask already encodes the glyph geometry in canvas pixel space,
    /// so we fill a full-canvas rect in pixel space and let the mask gate
    /// coverage. Gradients carry their own local transform (font-unit → pixel)
    /// via `brush_to_shader`.
    fn fill_with_brush(&mut self, brush: Brush<'_>) {
        let transform = self.current_transform();
        let Some(shader) = self.brush_to_shader(&brush, transform) else {
            return;
        };
        let paint = Paint {
            shader,
            anti_alias: true,
            blend_mode: BlendMode::SourceOver,
            ..Paint::default()
        };

        let (w, h) = (self.width as f32, self.height as f32);
        let Some(rect) = tiny_skia::Rect::from_xywh(0.0, 0.0, w, h) else {
            return;
        };
        let mut pb = PathBuilder::new();
        pb.push_rect(rect);
        let Some(path) = pb.finish() else {
            return;
        };

        let mask = self.current_clip().cloned();
        self.target_pixmap().fill_path(
            &path,
            &paint,
            FillRule::Winding,
            TsTransform::identity(),
            mask.as_ref(),
        );
    }
}

impl<'a> ColorPainter for ColorPainterImpl<'a> {
    fn push_transform(&mut self, transform: Transform) {
        let parent = self.current_transform();
        // skrifa's Matrix: x' = xx*x + xy*y + dx; y' = yx*x + yy*y + dy
        // tiny-skia from_row(sx, ky, kx, sy, tx, ty): same convention with
        // (sx, ky, kx, sy, tx, ty) ≡ (xx, yx, xy, yy, dx, dy).
        let child = TsTransform::from_row(
            transform.xx,
            transform.yx,
            transform.xy,
            transform.yy,
            transform.dx,
            transform.dy,
        );
        // Child paint runs first, then parent transform places it.
        self.transforms.push(parent.pre_concat(child));
    }

    fn pop_transform(&mut self) {
        if self.transforms.len() > 1 {
            self.transforms.pop();
        }
    }

    fn push_clip_glyph(&mut self, glyph_id: GlyphId) {
        let path = match glyph_path(self.font, glyph_id) {
            Some(p) => p,
            None => {
                // Push an empty mask layer so pop_clip stays balanced.
                let empty = Mask::new(self.width.max(1), self.height.max(1));
                self.clip_stack.push(empty);
                return;
            }
        };
        self.push_clip_path(&path);
    }

    fn push_clip_box(&mut self, clip_box: BoundingBox<f32>) {
        let rect = match tiny_skia::Rect::from_ltrb(
            clip_box.x_min,
            clip_box.y_min,
            clip_box.x_max,
            clip_box.y_max,
        ) {
            Some(r) => r,
            None => {
                let empty = Mask::new(self.width.max(1), self.height.max(1));
                self.clip_stack.push(empty);
                return;
            }
        };
        let mut builder = PathBuilder::new();
        builder.push_rect(rect);
        let Some(path) = builder.finish() else {
            let empty = Mask::new(self.width.max(1), self.height.max(1));
            self.clip_stack.push(empty);
            return;
        };
        self.push_clip_path(&path);
    }

    fn pop_clip(&mut self) {
        if self.clip_stack.len() > 1 {
            self.clip_stack.pop();
        }
    }

    fn fill(&mut self, brush: Brush<'_>) {
        self.fill_with_brush(brush);
    }

    fn push_layer(&mut self, composite_mode: CompositeMode) {
        let pixmap = Pixmap::new(self.width.max(1), self.height.max(1));
        if let Some(mut pixmap) = pixmap {
            pixmap.fill(TsColor::TRANSPARENT);
            self.layers.push(Layer {
                pixmap,
                mode: composite_mode,
            });
        }
    }

    fn pop_layer(&mut self) {
        let Some(layer) = self.layers.pop() else {
            return;
        };
        let paint = PixmapPaint {
            blend_mode: composite_to_blend(layer.mode),
            ..PixmapPaint::default()
        };

        // Layer pixels were already clipped on draw — compositing the layer
        // down does not re-apply the current clip mask.
        let layer_ref = layer.pixmap.as_ref();
        self.target_pixmap()
            .draw_pixmap(0, 0, layer_ref, &paint, TsTransform::identity(), None);
    }
}

impl<'a> ColorPainterImpl<'a> {
    fn push_clip_path(&mut self, path: &Path) {
        let w = self.width.max(1);
        let h = self.height.max(1);
        let transform = self.current_transform();

        // Intersect with the existing clip when present.
        let new_mask = if let Some(parent) = self.current_clip() {
            let mut m = parent.clone();
            m.intersect_path(path, FillRule::Winding, true, transform);
            m
        } else {
            let Some(mut m) = Mask::new(w, h) else {
                let empty = Mask::new(w, h);
                self.clip_stack.push(empty);
                return;
            };
            m.fill_path(path, FillRule::Winding, true, transform);
            m
        };
        self.clip_stack.push(Some(new_mask));
    }
}

fn extend_to_spread(extend: Extend) -> SpreadMode {
    match extend {
        Extend::Pad => SpreadMode::Pad,
        Extend::Repeat => SpreadMode::Repeat,
        Extend::Reflect => SpreadMode::Reflect,
        _ => SpreadMode::Pad,
    }
}

fn composite_to_blend(mode: CompositeMode) -> BlendMode {
    match mode {
        CompositeMode::Clear => BlendMode::Clear,
        CompositeMode::Src => BlendMode::Source,
        CompositeMode::Dest => BlendMode::Destination,
        CompositeMode::SrcOver => BlendMode::SourceOver,
        CompositeMode::DestOver => BlendMode::DestinationOver,
        CompositeMode::SrcIn => BlendMode::SourceIn,
        CompositeMode::DestIn => BlendMode::DestinationIn,
        CompositeMode::SrcOut => BlendMode::SourceOut,
        CompositeMode::DestOut => BlendMode::DestinationOut,
        CompositeMode::SrcAtop => BlendMode::SourceAtop,
        CompositeMode::DestAtop => BlendMode::DestinationAtop,
        CompositeMode::Xor => BlendMode::Xor,
        CompositeMode::Plus => BlendMode::Plus,
        CompositeMode::Screen => BlendMode::Screen,
        CompositeMode::Overlay => BlendMode::Overlay,
        CompositeMode::Darken => BlendMode::Darken,
        CompositeMode::Lighten => BlendMode::Lighten,
        CompositeMode::ColorDodge => BlendMode::ColorDodge,
        CompositeMode::ColorBurn => BlendMode::ColorBurn,
        CompositeMode::HardLight => BlendMode::HardLight,
        CompositeMode::SoftLight => BlendMode::SoftLight,
        CompositeMode::Difference => BlendMode::Difference,
        CompositeMode::Exclusion => BlendMode::Exclusion,
        CompositeMode::Multiply => BlendMode::Multiply,
        CompositeMode::HslHue => BlendMode::Hue,
        CompositeMode::HslSaturation => BlendMode::Saturation,
        CompositeMode::HslColor => BlendMode::Color,
        CompositeMode::HslLuminosity => BlendMode::Luminosity,
        _ => BlendMode::SourceOver,
    }
}
