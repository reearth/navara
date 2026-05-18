//! Integration tests for the Slug-style curve pipeline (Phase 1).
//!
//! Exercises outline extraction → banding → packing against real font
//! fixtures. The point-counts here are not asserted to exact values because
//! they're sensitive to which glyph the font happens to expose at a given
//! GID; instead we assert structural invariants that any well-formed glyph
//! must satisfy.

use navara_wasm_font_worker::curves::{
    BAND_COUNT_DEFAULT, build_bands, extract_glyph_outline, pack_glyph,
};
use skrifa::{GlyphId, prelude::FontRef, raw::TableProvider};

const MONO_FONT: &[u8] = include_bytes!("fixtures/demo_monochrome.ttf");
const COLRV1_FONT: &[u8] = include_bytes!("fixtures/colrv1_test.ttf");

/// Find the first glyph ID whose outline has at least one curve.
fn first_outlined_gid(font: &FontRef<'_>) -> Option<GlyphId> {
    for gid in 1u32..200 {
        let id = GlyphId::new(gid);
        if let Some(outline) = extract_glyph_outline(font, id)
            && !outline.curves.is_empty()
        {
            return Some(id);
        }
    }
    None
}

#[test]
fn extracts_outline_for_a_monochrome_glyph() {
    let font = FontRef::new(MONO_FONT).expect("parse mono font");
    let gid = first_outlined_gid(&font).expect("mono fixture should have outlined glyphs");
    let outline = extract_glyph_outline(&font, gid).expect("extract");

    assert!(!outline.curves.is_empty(), "outline must have curves");
    assert!(outline.units_per_em > 0);

    // Bbox is finite and non-degenerate.
    assert!(outline.bbox_min[0].is_finite() && outline.bbox_min[1].is_finite());
    assert!(outline.bbox_max[0] > outline.bbox_min[0]);
    assert!(outline.bbox_max[1] > outline.bbox_min[1]);

    // Every curve's control polygon must lie inside the reported bbox.
    for c in &outline.curves {
        for p in [c.p0, c.p1, c.p2] {
            assert!(p[0] >= outline.bbox_min[0] - 1e-4 && p[0] <= outline.bbox_max[0] + 1e-4);
            assert!(p[1] >= outline.bbox_min[1] - 1e-4 && p[1] <= outline.bbox_max[1] + 1e-4);
        }
    }
}

#[test]
fn outline_is_normalized_to_em_space() {
    let font = FontRef::new(MONO_FONT).expect("parse mono font");
    let gid = first_outlined_gid(&font).expect("outlined glyph");
    let outline = extract_glyph_outline(&font, gid).expect("extract");

    // Em-normalized coordinates should fit comfortably inside [-2, 2].
    // Ascenders/descenders/diacritics may push past [0, 1] but not by much.
    for c in &outline.curves {
        for p in [c.p0, c.p1, c.p2] {
            assert!(
                p[0].abs() <= 2.0 && p[1].abs() <= 2.0,
                "coord {:?} not in em-space; UPM={}",
                p,
                outline.units_per_em,
            );
        }
    }
}

#[test]
fn banding_covers_every_curve() {
    let font = FontRef::new(MONO_FONT).expect("parse mono font");
    let gid = first_outlined_gid(&font).expect("outlined glyph");
    let outline = extract_glyph_outline(&font, gid).expect("extract");
    let total_curves = outline.curves.len();
    let banded = build_bands(outline, BAND_COUNT_DEFAULT);

    // Every curve must appear in at least one band — otherwise the fragment
    // shader would silently drop it.
    let mut seen = vec![false; total_curves];
    for band in &banded.bands {
        for &idx in &band.curve_indices {
            seen[idx as usize] = true;
        }
    }
    let missing: Vec<usize> = seen
        .iter()
        .enumerate()
        .filter_map(|(i, s)| if !*s { Some(i) } else { None })
        .collect();
    assert!(
        missing.is_empty(),
        "curves missing from bands: {:?}",
        missing
    );
}

#[test]
fn pack_round_trips_band_indices() {
    let font = FontRef::new(MONO_FONT).expect("parse mono font");
    let gid = first_outlined_gid(&font).expect("outlined glyph");
    let outline = extract_glyph_outline(&font, gid).expect("extract");
    let banded = build_bands(outline, BAND_COUNT_DEFAULT);
    let packed = pack_glyph(&banded);

    assert_eq!(packed.band_count() as u16, banded.band_count);
    assert_eq!(packed.curve_count(), banded.curves.len());

    // Walk every band entry and confirm the curve index it points at is valid.
    for entry in &packed.bands {
        let start = (entry >> 16) as usize;
        let count = (entry & 0xFFFF) as usize;
        assert!(
            start + count <= packed.band_curves.len(),
            "band entry {start}+{count} overflows band_curves ({})",
            packed.band_curves.len(),
        );
        for &ci in &packed.band_curves[start..start + count] {
            assert!(
                (ci as usize) < packed.curve_count(),
                "band entry references curve {ci} but only {} curves packed",
                packed.curve_count(),
            );
        }
    }
}

/// COLRv1 glyphs are still drawable as monochrome outlines via the base
/// 'glyf' / 'CFF' table; the curve pipeline must produce a sane outline for
/// them too (it's what the GPU COLRv1 layer evaluator will consume in Phase 2).
#[test]
fn extracts_outline_for_a_colrv1_base_glyph() {
    let font = FontRef::new(COLRV1_FONT).expect("parse colrv1 font");
    // Skip GID 0 (.notdef) and look for a paintable color glyph that also has
    // an underlying outline.
    let gid = first_outlined_gid(&font).expect("colrv1 fixture has base outlines");
    let outline = extract_glyph_outline(&font, gid).expect("extract");
    assert!(!outline.curves.is_empty());

    let banded = build_bands(outline, BAND_COUNT_DEFAULT);
    let packed = pack_glyph(&banded);
    assert!(packed.curve_count() > 0);
    assert!(!packed.bands.is_empty());
}

#[test]
fn many_glyphs_extract_without_panic() {
    // Stress: extract every outlined glyph in both fixtures and verify
    // the pipeline is total over real font input.
    for (name, bytes) in [("mono", MONO_FONT), ("colrv1", COLRV1_FONT)] {
        let font = FontRef::new(bytes).expect("parse font");
        let mut extracted = 0usize;
        let glyph_count = font.maxp().ok().map(|m| m.num_glyphs()).unwrap_or(0);
        for gid in 0..glyph_count.min(256) {
            if let Some(outline) = extract_glyph_outline(&font, GlyphId::new(gid as u32)) {
                let banded = build_bands(outline, BAND_COUNT_DEFAULT);
                let _packed = pack_glyph(&banded);
                extracted += 1;
            }
        }
        assert!(extracted > 0, "{name}: no glyphs extracted at all");
    }
}
