//! GPU-friendly serialization of a banded glyph.
//!
//! Phase 1 just produces the *per-glyph* blob — Phase 3 will splice many of
//! these into the shared GPU buffers exposed across the WASM boundary, but the
//! layout is fixed here so the shader contract is stable.
//!
//! Layout (all coordinates in em-space, normalized by units_per_em):
//!
//! ```text
//!  header (12 f32, three RGBA32F texels)
//!      [0..2]   bbox_min.xy
//!      [2..4]   bbox_max.xy
//!      [4]      band_count         (whole f32, cast to int in the shader)
//!      [5]      bands_offset       (index into the global band-data buffer)
//!      [6]      band_curves_offset (index into the global band-curves buffer)
//!      [7]      curves_offset      (index into the global curve-data buffer)
//!      [8]      flags              (bit 0 = has_color_layers, set by Phase 3)
//!      [9]      color_layer_start  (index into color_layer_headers, when
//!                                   FLAG_HAS_COLOR_LAYERS is set)
//!      [10]     color_layer_count  (number of color layers belonging to this
//!                                   glyph; consumed by the COLR fragment path)
//!      [11]     reserved (zero)    — keeps the header texel-aligned
//!
//!  bands (one u32 per band)
//!      packed: (curve_start_in_band_curves << 16) | curve_count
//!      `curve_start` indexes into the band-curves buffer, *relative to this
//!      glyph's* `band_curves_offset`.
//!
//!  band_curves (one u16 per band-entry)
//!      Curve index relative to this glyph's curve table (i.e. relative to
//!      `curves_offset`).
//!
//!  curves (6 f32 per curve)
//!      p0.x p0.y p1.x p1.y p2.x p2.y
//! ```
//!
//! The three variable sections live in three separate GPU buffers (each
//! uploaded as a data texture in WebGL2 / storage buffer on WebGPU). Phase 3's
//! allocator decides where each glyph lands and writes the `*_offset` fields
//! into the header. The band entries' `curve_start` does not need biasing —
//! it's already glyph-relative against the band-curves table.

use crate::curves::bands::BandedGlyph;

/// Number of f32s in a [`PackedGlyph::header`]. Three RGBA32F texels.
pub const HEADER_F32_COUNT: usize = 12;

/// Number of f32s per curve entry (p0.xy, p1.xy, p2.xy).
pub const CURVE_F32_COUNT: usize = 6;

// Field offsets within [`PackedGlyph::header`]. Both the allocator and the
// GPU shader must agree on these slot numbers.
pub const HEADER_BBOX_MIN: usize = 0; // .xy → slots 0,1
pub const HEADER_BBOX_MAX: usize = 2; // .xy → slots 2,3
pub const HEADER_BAND_COUNT: usize = 4;
pub const HEADER_BANDS_OFFSET: usize = 5;
pub const HEADER_BAND_CURVES_OFFSET: usize = 6;
pub const HEADER_CURVES_OFFSET: usize = 7;
pub const HEADER_FLAGS: usize = 8;
pub const HEADER_COLOR_LAYER_START: usize = 9;
pub const HEADER_COLOR_LAYER_COUNT: usize = 10;

/// Bit set in `header[HEADER_FLAGS]` when the glyph has COLRv1 layer data
/// attached. Cleared by Phase 1 packing; set by Phase 3 when the cache binds
/// a color-layer record to the glyph slot.
pub const FLAG_HAS_COLOR_LAYERS: u32 = 1 << 0;

/// Packed representation of a single glyph, ready to be appended into the
/// shared GPU data texture.
///
/// `bands_offset` / `curves_offset` are left as 0 by `pack_glyph`; Phase 3's
/// allocator will fill them in when the per-glyph blob is placed in the
/// shared buffer. Same logic for the band entries' `curve_start` — it is
/// expressed relative to this glyph's `band_curves` and must be biased by the
/// allocator's `band_curves_offset` if `band_curves` is shared.
#[derive(Clone, Debug, Default)]
pub struct PackedGlyph {
    pub header: [f32; HEADER_F32_COUNT],
    /// One u32 per band: `(curve_start << 16) | curve_count`. `curve_start`
    /// indexes into [`Self::band_curves`].
    pub bands: Vec<u32>,
    /// Flat list of curve indices (into [`Self::curves`]) for every band,
    /// concatenated in band order. `bands[i]` slices into this.
    pub band_curves: Vec<u16>,
    /// Curve table: 6 f32 per quadratic Bezier.
    pub curves: Vec<f32>,
}

impl PackedGlyph {
    pub fn band_count(&self) -> u16 {
        self.bands.len() as u16
    }

    pub fn curve_count(&self) -> usize {
        self.curves.len() / CURVE_F32_COUNT
    }
}

/// Pack a banded glyph into flat f32/u32 buffers.
///
/// The `_offset` fields in the header are zeroed; the caller's allocator is
/// responsible for biasing them when these payloads are concatenated into a
/// shared buffer.
pub fn pack_glyph(glyph: &BandedGlyph) -> PackedGlyph {
    let mut bands = Vec::with_capacity(glyph.bands.len());
    let mut band_curves = Vec::with_capacity(glyph.total_band_entries());
    for band in &glyph.bands {
        let start = band_curves.len() as u32;
        let count = band.curve_indices.len() as u32;
        debug_assert!(start <= 0xFFFF, "band-curves overflow u16 within a glyph");
        debug_assert!(count <= 0xFFFF, "band curve count overflow u16");
        bands.push((start << 16) | (count & 0xFFFF));
        band_curves.extend_from_slice(&band.curve_indices);
    }

    let mut curves = Vec::with_capacity(glyph.curves.len() * CURVE_F32_COUNT);
    for c in &glyph.curves {
        curves.extend_from_slice(&[c.p0[0], c.p0[1], c.p1[0], c.p1[1], c.p2[0], c.p2[1]]);
    }

    let mut header = [0.0f32; HEADER_F32_COUNT];
    header[0] = glyph.bbox_min[0];
    header[1] = glyph.bbox_min[1];
    header[2] = glyph.bbox_max[0];
    header[3] = glyph.bbox_max[1];
    header[4] = glyph.band_count as f32;
    // header[5..8] (bands_offset, band_curves_offset, curves_offset) and
    // header[8] (flags) are filled in by the allocator at upload time.
    // header[9..12] reserved.

    PackedGlyph {
        header,
        bands,
        band_curves,
        curves,
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use crate::curves::bands::build_bands;
    use crate::curves::extract::{GlyphOutline, QuadCurve};

    fn outline(curves: Vec<QuadCurve>, bb_min: [f32; 2], bb_max: [f32; 2]) -> GlyphOutline {
        GlyphOutline {
            curves,
            bbox_min: bb_min,
            bbox_max: bb_max,
            units_per_em: 1000,
        }
    }

    #[test]
    fn header_carries_bbox_and_band_count() {
        let c = QuadCurve {
            p0: [0.0, 0.0],
            p1: [5.0, 10.0],
            p2: [10.0, 0.0],
        };
        let banded = build_bands(outline(vec![c], [0.0, 0.0], [10.0, 10.0]), 4);
        let packed = pack_glyph(&banded);

        assert_eq!(packed.header[HEADER_BBOX_MIN], 0.0);
        assert_eq!(packed.header[HEADER_BBOX_MIN + 1], 0.0);
        assert_eq!(packed.header[HEADER_BBOX_MAX], 10.0);
        assert_eq!(packed.header[HEADER_BBOX_MAX + 1], 10.0);
        assert_eq!(packed.header[HEADER_BAND_COUNT], 4.0);
        // Offsets stay zero until the shared-buffer allocator fills them in.
        assert_eq!(packed.header[HEADER_BANDS_OFFSET], 0.0);
        assert_eq!(packed.header[HEADER_BAND_CURVES_OFFSET], 0.0);
        assert_eq!(packed.header[HEADER_CURVES_OFFSET], 0.0);
        assert_eq!(packed.header[HEADER_FLAGS], 0.0);
        assert_eq!(packed.bands.len(), 4);
    }

    #[test]
    fn curves_are_serialized_in_order() {
        let c0 = QuadCurve {
            p0: [0.0, 0.0],
            p1: [1.0, 1.0],
            p2: [2.0, 2.0],
        };
        let c1 = QuadCurve {
            p0: [3.0, 3.0],
            p1: [4.0, 4.0],
            p2: [5.0, 5.0],
        };
        let banded = build_bands(outline(vec![c0, c1], [0.0, 0.0], [5.0, 5.0]), 1);
        let packed = pack_glyph(&banded);

        assert_eq!(packed.curve_count(), 2);
        // First curve at offset 0..6, second at 6..12.
        assert_eq!(&packed.curves[0..6], &[0.0, 0.0, 1.0, 1.0, 2.0, 2.0]);
        assert_eq!(&packed.curves[6..12], &[3.0, 3.0, 4.0, 4.0, 5.0, 5.0]);
    }

    #[test]
    fn band_entries_pack_start_and_count() {
        // One curve spanning both bands; 2 bands → both entries reference it.
        let c = QuadCurve {
            p0: [0.0, 0.0],
            p1: [0.0, 5.0],
            p2: [0.0, 10.0],
        };
        let banded = build_bands(outline(vec![c], [0.0, 0.0], [10.0, 10.0]), 2);
        let packed = pack_glyph(&banded);

        assert_eq!(packed.bands.len(), 2);
        let b0_start = packed.bands[0] >> 16;
        let b0_count = packed.bands[0] & 0xFFFF;
        let b1_start = packed.bands[1] >> 16;
        let b1_count = packed.bands[1] & 0xFFFF;

        assert_eq!(b0_start, 0);
        assert_eq!(b0_count, 1);
        assert_eq!(b1_start, 1);
        assert_eq!(b1_count, 1);

        // band_curves should be [0, 0] (both bands point at curve 0).
        assert_eq!(packed.band_curves, vec![0, 0]);
    }

    #[test]
    fn empty_glyph_packs_to_minimal_blob() {
        let banded = build_bands(outline(vec![], [0.0, 0.0], [0.0, 0.0]), 8);
        let packed = pack_glyph(&banded);
        assert_eq!(packed.curve_count(), 0);
        assert_eq!(packed.band_curves.len(), 0);
        // build_bands collapses empty glyphs to a single band.
        assert_eq!(packed.band_count(), 1);
        assert_eq!(packed.bands[0], 0);
    }
}
