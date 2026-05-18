//! Outline extraction with line/cubic → quadratic conversion.
//!
//! `skrifa` produces TrueType-flavored move/line/quad/cubic segments. The
//! Slug-style fragment shader only consumes quadratic Beziers, so:
//!
//! - lines become degenerate quads (control point = midpoint), so the same
//!   per-curve solver handles them with no branch.
//! - cubics are approximated by adaptive quadratic subdivision (Sederberg-style
//!   midpoint conversion + de Casteljau halving when the error exceeds
//!   [`CUBIC_TO_QUAD_TOL`] em-space units).
//!
//! Coordinates returned by this module are in **em units** (font units divided
//! by `units_per_em`). Contour winding from the source font is preserved.

use skrifa::{
    GlyphId, MetadataProvider,
    instance::{LocationRef, Size},
    outline::{DrawSettings, OutlinePen},
    prelude::FontRef,
    raw::TableProvider,
};

/// Maximum allowed deviation (in em units) between a cubic and its quadratic
/// approximation before we subdivide. 0.5 / 1024 ≈ 0.05% of the em — well
/// below one screen pixel at any practical text size.
pub const CUBIC_TO_QUAD_TOL: f32 = 0.5 / 1024.0;

/// Hard cap on cubic subdivision depth. Prevents pathological control
/// polygons (e.g. degenerate cubics where the midpoint test never converges)
/// from blowing the stack. A depth of 8 gives up to 256 quad segments per
/// source cubic, far more than any real glyph needs.
const MAX_CUBIC_SUBDIV_DEPTH: u8 = 8;

/// A single quadratic Bezier in em-space.
///
/// `p1` is the control point. For straight segments produced from `line_to`
/// the control point is set to the chord midpoint, making the curve
/// degenerate-but-valid for ray-cast solvers.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct QuadCurve {
    pub p0: [f32; 2],
    pub p1: [f32; 2],
    pub p2: [f32; 2],
}

impl QuadCurve {
    /// Y-extent of the curve (min, max).
    ///
    /// For a quadratic, the y derivative vanishes at
    ///     t* = (p0.y - p1.y) / (p0.y - 2*p1.y + p2.y)
    /// — we include B(t*).y in the extent when t* ∈ (0, 1) so curves that
    /// loop above their endpoints don't get incorrectly omitted from a band.
    pub fn y_extent(&self) -> (f32, f32) {
        let (y0, y1, y2) = (self.p0[1], self.p1[1], self.p2[1]);
        let mut lo = y0.min(y2);
        let mut hi = y0.max(y2);
        let denom = y0 - 2.0 * y1 + y2;
        if denom.abs() > f32::EPSILON {
            let t = (y0 - y1) / denom;
            if t > 0.0 && t < 1.0 {
                let one_t = 1.0 - t;
                let y = one_t * one_t * y0 + 2.0 * one_t * t * y1 + t * t * y2;
                lo = lo.min(y);
                hi = hi.max(y);
            }
        }
        (lo, hi)
    }
}

/// Extracted outline of a single glyph, ready for banding.
#[derive(Clone, Debug)]
pub struct GlyphOutline {
    /// All curves of all contours, flattened. Lines and cubics are converted
    /// to quadratics. Winding direction from the source font is preserved.
    pub curves: Vec<QuadCurve>,
    /// Em-space bounding box of all curve endpoints and control points.
    pub bbox_min: [f32; 2],
    pub bbox_max: [f32; 2],
    /// Source font's units-per-em, kept for the caller's reference. All
    /// coordinates above are *already* normalized by this value.
    pub units_per_em: u16,
}

impl GlyphOutline {
    pub fn is_empty(&self) -> bool {
        self.curves.is_empty()
    }
}

/// Extract a glyph outline in em-space.
///
/// Returns `None` if the font has no outline for `glyph_id` (e.g. blank/space
/// glyphs) or if `units_per_em` is zero. Empty glyphs that draw nothing return
/// `Some(GlyphOutline)` with `curves.is_empty()` — callers can decide whether
/// to keep a header entry for them.
pub fn extract_glyph_outline(font: &FontRef<'_>, glyph_id: GlyphId) -> Option<GlyphOutline> {
    let upem = font.head().ok()?.units_per_em();
    if upem == 0 {
        return None;
    }
    let inv_upem = 1.0 / upem as f32;

    let outlines = font.outline_glyphs();
    let outline = outlines.get(glyph_id)?;

    let mut pen = QuadPen::new(inv_upem);
    outline
        .draw(
            DrawSettings::unhinted(Size::unscaled(), LocationRef::default()),
            &mut pen,
        )
        .ok()?;

    let (bbox_min, bbox_max) = pen.bbox();
    Some(GlyphOutline {
        curves: pen.into_curves(),
        bbox_min,
        bbox_max,
        units_per_em: upem,
    })
}

// ---------------------------------------------------------------------------
// QuadPen: collects skrifa outline events into a flat Vec<QuadCurve>.
// ---------------------------------------------------------------------------

struct QuadPen {
    /// Scale applied to every incoming coordinate (1 / units_per_em).
    em: f32,
    curves: Vec<QuadCurve>,
    /// Current pen position in em-space.
    cur: [f32; 2],
    /// Start of the current contour, used to close it with an implicit line.
    contour_start: [f32; 2],
    /// Has any `move_to` been seen? Needed because `line_to` before `move_to`
    /// (malformed fonts) should be ignored, matching the existing color path.
    started: bool,
    bbox_min: [f32; 2],
    bbox_max: [f32; 2],
}

impl QuadPen {
    fn new(em: f32) -> Self {
        Self {
            em,
            curves: Vec::new(),
            cur: [0.0; 2],
            contour_start: [0.0; 2],
            started: false,
            bbox_min: [f32::INFINITY, f32::INFINITY],
            bbox_max: [f32::NEG_INFINITY, f32::NEG_INFINITY],
        }
    }

    fn em_point(&self, x: f32, y: f32) -> [f32; 2] {
        [x * self.em, y * self.em]
    }

    fn extend_bbox(&mut self, p: [f32; 2]) {
        self.bbox_min[0] = self.bbox_min[0].min(p[0]);
        self.bbox_min[1] = self.bbox_min[1].min(p[1]);
        self.bbox_max[0] = self.bbox_max[0].max(p[0]);
        self.bbox_max[1] = self.bbox_max[1].max(p[1]);
    }

    fn push_quad(&mut self, p0: [f32; 2], p1: [f32; 2], p2: [f32; 2]) {
        self.extend_bbox(p0);
        self.extend_bbox(p1);
        self.extend_bbox(p2);
        self.curves.push(QuadCurve { p0, p1, p2 });
    }

    fn push_line(&mut self, p0: [f32; 2], p2: [f32; 2]) {
        let mid = [(p0[0] + p2[0]) * 0.5, (p0[1] + p2[1]) * 0.5];
        self.push_quad(p0, mid, p2);
    }

    fn bbox(&self) -> ([f32; 2], [f32; 2]) {
        if self.curves.is_empty() {
            ([0.0; 2], [0.0; 2])
        } else {
            (self.bbox_min, self.bbox_max)
        }
    }

    fn into_curves(self) -> Vec<QuadCurve> {
        self.curves
    }
}

impl OutlinePen for QuadPen {
    fn move_to(&mut self, x: f32, y: f32) {
        let p = self.em_point(x, y);
        self.cur = p;
        self.contour_start = p;
        self.started = true;
    }

    fn line_to(&mut self, x: f32, y: f32) {
        if !self.started {
            return;
        }
        let p = self.em_point(x, y);
        let prev = self.cur;
        self.push_line(prev, p);
        self.cur = p;
    }

    fn quad_to(&mut self, cx: f32, cy: f32, x: f32, y: f32) {
        if !self.started {
            return;
        }
        let c = self.em_point(cx, cy);
        let p = self.em_point(x, y);
        let prev = self.cur;
        self.push_quad(prev, c, p);
        self.cur = p;
    }

    fn curve_to(&mut self, cx0: f32, cy0: f32, cx1: f32, cy1: f32, x: f32, y: f32) {
        if !self.started {
            return;
        }
        let c0 = self.em_point(cx0, cy0);
        let c1 = self.em_point(cx1, cy1);
        let p = self.em_point(x, y);
        let prev = self.cur;
        approx_cubic_with_quads(prev, c0, c1, p, CUBIC_TO_QUAD_TOL, 0, &mut |q| {
            self.curves.push(q);
            self.extend_bbox(q.p0);
            self.extend_bbox(q.p1);
            self.extend_bbox(q.p2);
        });
        self.cur = p;
    }

    fn close(&mut self) {
        if !self.started {
            return;
        }
        // Implicit closing line — most fonts don't emit it explicitly.
        if self.cur != self.contour_start {
            let prev = self.cur;
            let start = self.contour_start;
            self.push_line(prev, start);
        }
        self.cur = self.contour_start;
    }
}

// ---------------------------------------------------------------------------
// Cubic → quadratic approximation
// ---------------------------------------------------------------------------

/// Approximate a single cubic Bezier with one or more quadratic Beziers,
/// pushing each emitted quad through `emit`.
///
/// Uses the standard "average of the two natural quadratic projections"
/// midpoint construction:
///     q_ctrl = (3*c0 + 3*c1 - p0 - p3) / 4
/// The infinity-norm of the residual `p0 - 3*c0 + 3*c1 - p3` (scaled by 1/6)
/// bounds the L∞ deviation between the cubic and the candidate quadratic. If
/// it exceeds the tolerance the cubic is split in half via de Casteljau and
/// the two halves are recursed.
fn approx_cubic_with_quads(
    p0: [f32; 2],
    c0: [f32; 2],
    c1: [f32; 2],
    p3: [f32; 2],
    tol: f32,
    depth: u8,
    emit: &mut impl FnMut(QuadCurve),
) {
    // Conversion error vector (1/6 of the cubic's 4th-difference). When tiny,
    // the cubic is effectively quadratic and a single quad reproduces it.
    let res_x = (p0[0] - 3.0 * c0[0] + 3.0 * c1[0] - p3[0]).abs() / 6.0;
    let res_y = (p0[1] - 3.0 * c0[1] + 3.0 * c1[1] - p3[1]).abs() / 6.0;
    let err = res_x.max(res_y);

    if err <= tol || depth >= MAX_CUBIC_SUBDIV_DEPTH {
        let q = [
            (3.0 * c0[0] + 3.0 * c1[0] - p0[0] - p3[0]) * 0.25,
            (3.0 * c0[1] + 3.0 * c1[1] - p0[1] - p3[1]) * 0.25,
        ];
        emit(QuadCurve { p0, p1: q, p2: p3 });
        return;
    }

    // de Casteljau subdivide at t = 0.5.
    let m01 = midpoint(p0, c0);
    let m12 = midpoint(c0, c1);
    let m23 = midpoint(c1, p3);
    let m012 = midpoint(m01, m12);
    let m123 = midpoint(m12, m23);
    let m = midpoint(m012, m123);

    approx_cubic_with_quads(p0, m01, m012, m, tol, depth + 1, emit);
    approx_cubic_with_quads(m, m123, m23, p3, tol, depth + 1, emit);
}

#[inline]
fn midpoint(a: [f32; 2], b: [f32; 2]) -> [f32; 2] {
    [(a[0] + b[0]) * 0.5, (a[1] + b[1]) * 0.5]
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    fn q(p0: [f32; 2], p1: [f32; 2], p2: [f32; 2]) -> QuadCurve {
        QuadCurve { p0, p1, p2 }
    }

    #[test]
    fn line_becomes_degenerate_quad() {
        let mut pen = QuadPen::new(1.0);
        pen.move_to(0.0, 0.0);
        pen.line_to(10.0, 4.0);
        assert_eq!(pen.curves.len(), 1);
        let c = pen.curves[0];
        assert_eq!(c.p0, [0.0, 0.0]);
        assert_eq!(c.p1, [5.0, 2.0]); // chord midpoint
        assert_eq!(c.p2, [10.0, 4.0]);
    }

    #[test]
    fn quad_passes_through_unchanged() {
        let mut pen = QuadPen::new(1.0);
        pen.move_to(0.0, 0.0);
        pen.quad_to(5.0, 10.0, 10.0, 0.0);
        assert_eq!(pen.curves.len(), 1);
        assert_eq!(pen.curves[0], q([0.0, 0.0], [5.0, 10.0], [10.0, 0.0]));
    }

    #[test]
    fn already_quadratic_cubic_collapses_to_single_quad() {
        // A cubic that is exactly a quadratic in disguise:
        // c0 = (p0 + 2*q)/3, c1 = (2*q + p3)/3, where q is the quad control.
        let p0 = [0.0, 0.0];
        let qc = [5.0, 10.0];
        let p3 = [10.0, 0.0];
        let c0 = [(p0[0] + 2.0 * qc[0]) / 3.0, (p0[1] + 2.0 * qc[1]) / 3.0];
        let c1 = [(2.0 * qc[0] + p3[0]) / 3.0, (2.0 * qc[1] + p3[1]) / 3.0];
        let mut out = Vec::new();
        approx_cubic_with_quads(p0, c0, c1, p3, CUBIC_TO_QUAD_TOL, 0, &mut |q| out.push(q));
        assert_eq!(out.len(), 1, "exactly-quadratic cubic should not subdivide");
        let got = out[0];
        let dx = (got.p1[0] - qc[0]).abs();
        let dy = (got.p1[1] - qc[1]).abs();
        assert!(dx < 1e-4 && dy < 1e-4, "recovered control {:?}", got.p1);
    }

    #[test]
    fn s_curve_cubic_subdivides() {
        // Classic S-curve where one quadratic can't possibly fit.
        let mut out = Vec::new();
        approx_cubic_with_quads(
            [0.0, 0.0],
            [1.0, 10.0],
            [9.0, -10.0],
            [10.0, 0.0],
            CUBIC_TO_QUAD_TOL,
            0,
            &mut |q| out.push(q),
        );
        assert!(out.len() >= 2, "S-curve must subdivide, got {}", out.len());
        // First quad starts at the cubic's p0 and last ends at the cubic's p3.
        assert_eq!(out.first().unwrap().p0, [0.0, 0.0]);
        assert_eq!(out.last().unwrap().p2, [10.0, 0.0]);
        // Consecutive quads share endpoints (continuous curve).
        for w in out.windows(2) {
            assert_eq!(w[0].p2, w[1].p0);
        }
    }

    #[test]
    fn close_inserts_implicit_line() {
        let mut pen = QuadPen::new(1.0);
        pen.move_to(0.0, 0.0);
        pen.line_to(10.0, 0.0);
        pen.line_to(10.0, 10.0);
        pen.close();
        // 2 explicit lines + 1 implicit closing line
        assert_eq!(pen.curves.len(), 3);
        let last = pen.curves.last().unwrap();
        assert_eq!(last.p0, [10.0, 10.0]);
        assert_eq!(last.p2, [0.0, 0.0]);
    }

    #[test]
    fn y_extent_includes_curve_apex() {
        // Quad with apex above its endpoints.
        let c = q([0.0, 0.0], [5.0, 20.0], [10.0, 0.0]);
        let (lo, hi) = c.y_extent();
        assert_eq!(lo, 0.0);
        assert!(hi > 0.0 && hi <= 20.0, "apex y was {}", hi);
        // Closed form: apex y at t=0.5 is (0 + 2*20 + 0)/4 = 10
        assert!((hi - 10.0).abs() < 1e-4);
    }

    #[test]
    fn em_scaling_normalizes_to_unit_space() {
        let mut pen = QuadPen::new(1.0 / 1000.0); // UPM = 1000
        pen.move_to(0.0, 0.0);
        pen.line_to(1000.0, 1000.0);
        let c = pen.curves[0];
        assert_eq!(c.p0, [0.0, 0.0]);
        assert_eq!(c.p2, [1.0, 1.0]);
    }
}
