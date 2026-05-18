//! Horizontal band acceleration structure.
//!
//! The fragment shader needs to know, for each pixel, which curves cross that
//! pixel's row in em-space. Testing every curve in the glyph per pixel is
//! O(curves × pixels) and untenable for CJK glyphs with hundreds of curves.
//!
//! We slice each glyph's em-space bbox into N equal-height horizontal bands
//! and, for each band, list the curve indices whose y-extent overlaps that
//! band. At render time the fragment derives its band from `local_y * N`
//! and only ray-casts the curves in that band.
//!
//! Curves are sorted by their leftmost x within each band so the shader can
//! early-out (or trivially reject) when a band has nothing to the left of the
//! pixel — useful for very wide glyphs (ligatures, joined Arabic).

use crate::curves::extract::{GlyphOutline, QuadCurve};

/// Default band count for a glyph. Tuned empirically against the Slug paper's
/// recommendations: Latin/Cyrillic comfortably fit in 6–8, CJK needs ~12–16.
/// 8 is a reasonable middle ground for the initial pipeline; the pack format
/// stores band_count per glyph so this can be tuned per glyph later.
pub const BAND_COUNT_DEFAULT: u16 = 8;

/// One horizontal slice of a glyph's bbox.
#[derive(Clone, Debug, Default)]
pub struct Band {
    /// Indices into [`BandedGlyph::curves`], sorted ascending by curve leftmost x.
    pub curve_indices: Vec<u16>,
}

/// A glyph outline plus its band index, ready to be packed for the GPU.
#[derive(Clone, Debug)]
pub struct BandedGlyph {
    pub bbox_min: [f32; 2],
    pub bbox_max: [f32; 2],
    pub curves: Vec<QuadCurve>,
    /// `bands.len() == band_count`. Bands are ordered from `bbox_min.y` (band 0)
    /// to `bbox_max.y` (band N-1).
    pub bands: Vec<Band>,
    pub band_count: u16,
    pub units_per_em: u16,
}

impl BandedGlyph {
    pub fn is_empty(&self) -> bool {
        self.curves.is_empty()
    }

    /// Total curve references summed across all bands. A single curve typically
    /// appears in 1–3 bands; this number drives the band-table buffer size.
    pub fn total_band_entries(&self) -> usize {
        self.bands.iter().map(|b| b.curve_indices.len()).sum()
    }
}

/// Build the band acceleration structure for a glyph.
///
/// `band_count` is clamped to `[1, u16::MAX]` and to a value not greater than
/// what the bbox can usefully resolve (zero-height glyphs collapse to a single
/// band).
pub fn build_bands(outline: GlyphOutline, band_count: u16) -> BandedGlyph {
    let GlyphOutline {
        curves,
        bbox_min,
        bbox_max,
        units_per_em,
    } = outline;

    let height = bbox_max[1] - bbox_min[1];
    // Empty glyphs collapse to a single empty band. Zero-height glyphs
    // (all curves on one horizontal line — uncommon but legal) also collapse
    // to a single band, which we populate below with every curve.
    let n = if curves.is_empty() || height <= 0.0 {
        1
    } else {
        band_count.max(1)
    };

    let mut bands: Vec<Band> = (0..n).map(|_| Band::default()).collect();

    if !curves.is_empty() {
        if height <= 0.0 {
            // Degenerate y-range: dump every curve into the only band.
            for idx in 0..curves.len() {
                bands[0].curve_indices.push(idx as u16);
            }
        } else {
            let inv_h = 1.0 / height;
            for (idx, curve) in curves.iter().enumerate() {
                let (y_lo, y_hi) = curve.y_extent();
                // Map curve y-extent into [0, n). A curve sitting on
                // bbox_max.y would map to index n, so we clamp back into
                // the last band rather than dropping it.
                let t_lo = ((y_lo - bbox_min[1]) * inv_h * n as f32).floor() as i32;
                let t_hi = ((y_hi - bbox_min[1]) * inv_h * n as f32).floor() as i32;
                let lo = t_lo.clamp(0, n as i32 - 1) as u16;
                let hi = t_hi.clamp(0, n as i32 - 1) as u16;
                for band_idx in lo..=hi {
                    bands[band_idx as usize].curve_indices.push(idx as u16);
                }
            }
        }

        // Sort each band by leftmost x of the curve's control polygon. The
        // shader can use this ordering to short-circuit once curves move past
        // the pixel's x.
        for band in &mut bands {
            band.curve_indices.sort_by(|&a, &b| {
                let ca = leftmost_x(&curves[a as usize]);
                let cb = leftmost_x(&curves[b as usize]);
                ca.partial_cmp(&cb).unwrap_or(std::cmp::Ordering::Equal)
            });
        }
    }

    BandedGlyph {
        bbox_min,
        bbox_max,
        curves,
        bands,
        band_count: n,
        units_per_em,
    }
}

#[inline]
fn leftmost_x(c: &QuadCurve) -> f32 {
    c.p0[0].min(c.p1[0]).min(c.p2[0])
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    fn outline_from(curves: Vec<QuadCurve>) -> GlyphOutline {
        let mut bb_min = [f32::INFINITY; 2];
        let mut bb_max = [f32::NEG_INFINITY; 2];
        for c in &curves {
            for p in [c.p0, c.p1, c.p2] {
                bb_min[0] = bb_min[0].min(p[0]);
                bb_min[1] = bb_min[1].min(p[1]);
                bb_max[0] = bb_max[0].max(p[0]);
                bb_max[1] = bb_max[1].max(p[1]);
            }
        }
        if curves.is_empty() {
            bb_min = [0.0; 2];
            bb_max = [0.0; 2];
        }
        GlyphOutline {
            curves,
            bbox_min: bb_min,
            bbox_max: bb_max,
            units_per_em: 1000,
        }
    }

    #[test]
    fn empty_outline_yields_single_empty_band() {
        let banded = build_bands(outline_from(vec![]), 8);
        assert_eq!(banded.band_count, 1);
        assert_eq!(banded.bands.len(), 1);
        assert!(banded.bands[0].curve_indices.is_empty());
    }

    #[test]
    fn curve_spans_only_its_y_range() {
        // Horizontal line from (0,0)→(10,0), bbox y=[0,10].
        // The line lives in band 0; bands 1..7 should be empty.
        let line_bottom = QuadCurve {
            p0: [0.0, 0.0],
            p1: [5.0, 0.0],
            p2: [10.0, 0.0],
        };
        let line_top = QuadCurve {
            p0: [0.0, 10.0],
            p1: [5.0, 10.0],
            p2: [10.0, 10.0],
        };
        let banded = build_bands(outline_from(vec![line_bottom, line_top]), 8);
        assert_eq!(banded.band_count, 8);
        assert_eq!(banded.bands[0].curve_indices, vec![0]);
        assert_eq!(banded.bands[7].curve_indices, vec![1]);
        for i in 1..7 {
            assert!(
                banded.bands[i].curve_indices.is_empty(),
                "band {i} non-empty"
            );
        }
    }

    #[test]
    fn tall_curve_spans_many_bands() {
        // Vertical line: y from 0 to 80, bbox = [0,0]..[10,80].
        let tall = QuadCurve {
            p0: [5.0, 0.0],
            p1: [5.0, 40.0],
            p2: [5.0, 80.0],
        };
        let banded = build_bands(outline_from(vec![tall]), 8);
        assert_eq!(banded.band_count, 8);
        // The curve covers the full y range; it should appear in every band.
        for (i, band) in banded.bands.iter().enumerate() {
            assert_eq!(band.curve_indices, vec![0], "band {i} missing the curve");
        }
    }

    #[test]
    fn curves_in_band_sorted_by_leftmost_x() {
        let right = QuadCurve {
            p0: [50.0, 0.0],
            p1: [55.0, 0.0],
            p2: [60.0, 0.0],
        };
        let left = QuadCurve {
            p0: [0.0, 0.0],
            p1: [5.0, 0.0],
            p2: [10.0, 0.0],
        };
        let banded = build_bands(outline_from(vec![right, left]), 1);
        // 1 band, both curves; should be ordered (left=1, right=0).
        assert_eq!(banded.bands[0].curve_indices, vec![1, 0]);
    }

    #[test]
    fn curve_apex_inside_band_keeps_curve_in_that_band() {
        // Endpoints at y=0, control y=20, apex y=10. Without the apex-aware
        // y_extent this would only register in the bottom band and the shader
        // would miss every pixel above y=0.
        let arc = QuadCurve {
            p0: [0.0, 0.0],
            p1: [5.0, 20.0],
            p2: [10.0, 0.0],
        };
        // Build a manual outline whose bbox matches the apex (not the control
        // polygon), simulating what a real fragment-shader-ready bbox looks
        // like once we shrink to the actual visible curve range.
        let outline = GlyphOutline {
            curves: vec![arc],
            bbox_min: [0.0, 0.0],
            bbox_max: [10.0, 10.0], // == apex y
            units_per_em: 1000,
        };
        let banded = build_bands(outline, 4);
        // Apex extent [0, 10] now covers all 4 bands of height 2.5.
        for i in 0..4 {
            assert!(
                banded.bands[i].curve_indices.contains(&0),
                "arc missing from band {i}",
            );
        }
    }
}
