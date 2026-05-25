//! Multi-channel signed distance field (MSDF) glyph rasterization.
//!
//! Uses [`fdsm`] (pure-Rust port of Chlumský's `msdfgen`) to compute a
//! 4-channel **MTSDF**: the three MSDF channels plus a true (single-channel)
//! SDF in alpha. The shader takes `median(rgb)` for sharp-corner glyph fill;
//! the alpha is available for effects (glow, thick outlines) that prefer a
//! smooth distance.
//!
//! RGBA also matches what WebGL2 / three.js want — `RGBFormat` was removed
//! in r137 and three falls back to RGBA-padded storage anyway, so we may as
//! well make the fourth channel useful.
//!
//! The output is in OpenGL Y-up convention (row 0 = bottom of glyph), which
//! lets [`crate::atlas::SDFAtlas`] copy MTSDF bitmaps without the Y-flip
//! step it applies to single-channel SDFs.

use fdsm::{
    bezier::scanline::FillRule, generate::generate_mtsdf, render::correct_sign_mtsdf, shape::Shape,
    transform::Transform,
};
use image::RgbaImage;
use nalgebra::{Affine2, Similarity2, Vector2};
pub use ttf_parser::Face;

/// Number of pixels around the glyph reserved for the distance ramp.
/// Acts as MSDF's equivalent of [`crate::atlas::SDF_BUFFER`] — small values
/// give crisper edges; larger values let the shader render thicker outlines.
///
/// 8 px is a middle-ground default: tight enough to keep the atlas compact,
/// loose enough that bilinear sampling near the edge still lands on a valid
/// distance ramp. Anything ≤ 4 starts producing visible artifacts on curved
/// glyphs because `fwidth(dist)` saturates too quickly past the edge.
pub const MSDF_RANGE_PX: f64 = 8.0;

/// Bytes per pixel for the MSDF atlas: R, G, B = MSDF channels; A = true SDF.
pub const MSDF_CHANNELS: usize = 4;

/// Result of rasterizing one glyph to MSDF.
pub struct MsdfGlyph {
    /// Interleaved RGB pixels, row-major, Y-up (row 0 = bottom of glyph).
    pub pixels: Vec<u8>,
    pub width: u32,
    pub height: u32,
    /// Horizontal offset (pixels) from the glyph origin to the left edge
    /// of the bitmap. Matches `fontdue::Metrics::xmin` semantics minus the
    /// padding, so atlas code can store it directly.
    pub bearing_x: f32,
    /// Vertical offset (pixels) from the baseline to the bottom edge of
    /// the bitmap. Matches `fontdue::Metrics::ymin` semantics.
    pub bearing_y: f32,
}

/// Rasterize a single glyph from a pre-parsed face into an MSDF bitmap.
///
/// `px_size` is the target glyph height in pixels (analogous to
/// [`crate::atlas::SDF_PX_SIZE`]). Empty glyphs (spaces, control chars) and
/// glyphs whose outline cannot be loaded return `None`.
///
/// The caller parses `Face` once per font and reuses it across glyphs — parsing
/// is a few hundred microseconds per call (cmap, kern, hmtx, etc.) and was
/// previously dominating MSDF cost when many unique glyphs were rasterized in
/// one batch.
pub fn rasterize_msdf(face: &Face<'_>, glyph_id: u16, px_size: f32) -> Option<MsdfGlyph> {
    let units_per_em = face.units_per_em() as f64;
    if units_per_em == 0.0 {
        return None;
    }

    let gid = ttf_parser::GlyphId(glyph_id);
    let mut shape = fdsm_ttf_parser::load_shape_from_face(face, gid)?;
    let bbox = face.glyph_bounding_box(gid)?;

    // Font units per output pixel. Same conversion the fontdue path applies
    // when rasterizing at `px_size`.
    let shrinkage = units_per_em / px_size as f64;

    let x_extent = (bbox.x_max as f64 - bbox.x_min as f64) / shrinkage;
    let y_extent = (bbox.y_max as f64 - bbox.y_min as f64) / shrinkage;
    let width = (x_extent + 2.0 * MSDF_RANGE_PX).ceil() as u32;
    let height = (y_extent + 2.0 * MSDF_RANGE_PX).ceil() as u32;
    if width == 0 || height == 0 {
        return None;
    }

    // Map font-unit space to pixel space: bbox.min lands at (RANGE, RANGE),
    // leaving MSDF_RANGE_PX of padding on every side for the distance ramp.
    let transformation = nalgebra::convert::<_, Affine2<f64>>(Similarity2::new(
        Vector2::new(
            MSDF_RANGE_PX - bbox.x_min as f64 / shrinkage,
            MSDF_RANGE_PX - bbox.y_min as f64 / shrinkage,
        ),
        0.0,
        1.0 / shrinkage,
    ));

    shape.transform(&transformation);

    // Frank Chlumský's simple edge coloring. Threshold is `sin(angle)` of
    // the smallest "corner" we consider sharp enough to recolor across —
    // edges below that are treated as a smooth continuation and keep the
    // same color. The fdsm example uses 0.03 (~1.7°) which is aggressive
    // and causes adjacent micro-segments on smooth curves to pick up
    // different colors, breaking the `median(rgb)` invariant and producing
    // patchy fills. `msdfgen`'s default is ~3° (≈0.0523), which produces
    // visibly cleaner glyph interiors.
    let colored = Shape::edge_coloring_simple(shape, 0.0523, 0x9b_0c_4f_a3);
    let prepared = colored.prepare();

    let mut msdf = RgbaImage::new(width, height);
    generate_mtsdf(&prepared, MSDF_RANGE_PX, &mut msdf);
    correct_sign_mtsdf(&mut msdf, &prepared, FillRule::Nonzero);

    Some(MsdfGlyph {
        pixels: msdf.into_raw(),
        width,
        height,
        // bbox.x_min in pixels, then subtract padding so atlas code lands the
        // glyph at the right place relative to the cursor.
        bearing_x: (bbox.x_min as f64 / shrinkage - MSDF_RANGE_PX) as f32,
        bearing_y: (bbox.y_min as f64 / shrinkage - MSDF_RANGE_PX) as f32,
    })
}
