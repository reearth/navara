//! Integration tests for the COLRv1 flatten + pack pipeline (Phase 2).

use navara_wasm_font_worker::curves::{
    BlendTag, CLIP_RECORD_U32S, ClipShape, ClipTag, LAYER_HEADER_U32S, PackedColorGlyph, PaintKind,
    PaintTag, extract_color_glyph, pack_color_glyph,
};
use skrifa::{GlyphId, prelude::FontRef, raw::TableProvider};

const COLRV1_FONT: &[u8] = include_bytes!("fixtures/colrv1_test.ttf");
const MONO_FONT: &[u8] = include_bytes!("fixtures/demo_monochrome.ttf");

/// Find the first GID whose COLRv1 paint graph produces at least one layer.
fn first_color_gid(font: &FontRef<'_>) -> Option<GlyphId> {
    let glyph_count = font.maxp().ok().map(|m| m.num_glyphs()).unwrap_or(0);
    for gid in 1..glyph_count {
        let id = GlyphId::new(gid as u32);
        if let Some(g) = extract_color_glyph(font, id)
            && !g.layers.is_empty()
        {
            return Some(id);
        }
    }
    None
}

#[test]
fn monochrome_font_has_no_color_glyphs() {
    let font = FontRef::new(MONO_FONT).expect("parse mono font");
    // GID 0..50 should all return None since there's no COLR table.
    for gid in 0..50 {
        assert!(
            extract_color_glyph(&font, GlyphId::new(gid)).is_none(),
            "monochrome font yielded a color glyph for GID {gid}",
        );
    }
}

#[test]
fn extracts_a_colrv1_glyph_with_layers() {
    let font = FontRef::new(COLRV1_FONT).expect("parse colrv1 font");
    let gid = first_color_gid(&font).expect("fixture has at least one paintable COLRv1 glyph");
    let glyph = extract_color_glyph(&font, gid).expect("extract");

    assert!(!glyph.is_empty(), "GID {gid:?} yielded zero layers");
    assert!(glyph.units_per_em > 0);

    // Every layer's transform must be finite.
    for (i, layer) in glyph.layers.iter().enumerate() {
        for v in layer.transform {
            assert!(
                v.is_finite(),
                "layer {i} transform NaN/inf: {:?}",
                layer.transform
            );
        }
    }
}

#[test]
fn paint_params_are_finite_and_well_formed() {
    let font = FontRef::new(COLRV1_FONT).expect("parse colrv1 font");
    let gid = first_color_gid(&font).expect("paintable glyph");
    let glyph = extract_color_glyph(&font, gid).expect("extract");

    for (i, layer) in glyph.layers.iter().enumerate() {
        match &layer.paint {
            PaintKind::Solid { rgba } => {
                for c in rgba {
                    assert!(*c >= 0.0 && *c <= 1.0, "layer {i} solid color out of range");
                }
            }
            PaintKind::LinearGradient { p0, p1, stops, .. } => {
                assert!(p0.iter().all(|v| v.is_finite()));
                assert!(p1.iter().all(|v| v.is_finite()));
                assert!(!stops.is_empty(), "linear gradient has zero stops");
                for s in stops {
                    assert!(s.offset.is_finite());
                    for c in s.rgba {
                        assert!((0.0..=1.0).contains(&c));
                    }
                }
            }
            PaintKind::RadialGradient {
                c0,
                r0,
                c1,
                r1,
                stops,
                ..
            } => {
                assert!(c0.iter().all(|v| v.is_finite()));
                assert!(c1.iter().all(|v| v.is_finite()));
                assert!(r0.is_finite() && r1.is_finite());
                assert!(!stops.is_empty());
            }
            PaintKind::SweepGradient {
                center,
                start_angle,
                end_angle,
                stops,
                ..
            } => {
                assert!(center.iter().all(|v| v.is_finite()));
                assert!(start_angle.is_finite() && end_angle.is_finite());
                assert!(!stops.is_empty());
            }
        }
    }
}

#[test]
fn clips_reference_real_glyph_ids() {
    let font = FontRef::new(COLRV1_FONT).expect("parse colrv1 font");
    let glyph_count = font.maxp().ok().map(|m| m.num_glyphs()).unwrap_or(0) as u32;
    assert!(glyph_count > 0, "colrv1 fixture has no glyphs");

    let gid = first_color_gid(&font).expect("paintable glyph");
    let glyph = extract_color_glyph(&font, gid).expect("extract");

    for (i, layer) in glyph.layers.iter().enumerate() {
        for clip in &layer.clips {
            if let ClipShape::Glyph { gid, .. } = clip {
                assert!(
                    *gid < glyph_count,
                    "layer {i} clip references GID {gid} but font only has {glyph_count}",
                );
            }
        }
    }
}

/// Packed buffers must satisfy the layout contract: layer headers are
/// fixed-size, clip records are fixed-size, paint_offset/clip_offset for each
/// layer point to valid ranges.
#[test]
fn pack_layout_is_self_consistent() {
    let font = FontRef::new(COLRV1_FONT).expect("parse colrv1 font");
    let gid = first_color_gid(&font).expect("paintable glyph");
    let glyph = extract_color_glyph(&font, gid).expect("extract");
    let packed: PackedColorGlyph = pack_color_glyph(&glyph);

    assert_eq!(packed.layer_headers.len() % LAYER_HEADER_U32S, 0);
    assert_eq!(packed.clip_records.len() % CLIP_RECORD_U32S, 0);
    assert_eq!(packed.layer_count(), glyph.layers.len());

    // Every clip kind tag in the records must be a valid ClipTag.
    for clip_idx in 0..packed.clip_count() {
        let base = clip_idx * CLIP_RECORD_U32S;
        let tag = packed.clip_records[base];
        assert!(
            tag == ClipTag::Glyph as u32 || tag == ClipTag::Rect as u32,
            "clip {clip_idx} has invalid tag {tag}",
        );
    }

    // For each layer header, verify offsets fall within their buffers.
    for layer_idx in 0..packed.layer_count() {
        let base = layer_idx * LAYER_HEADER_U32S;
        let kind_blend = packed.layer_headers[base + 6];
        let paint_tag = kind_blend >> 16;
        let blend_tag = kind_blend & 0xFFFF;
        assert!(
            paint_tag <= PaintTag::Sweep as u32,
            "layer {layer_idx} paint tag invalid: {paint_tag}",
        );
        assert!(
            blend_tag <= BlendTag::Luminosity as u32,
            "layer {layer_idx} blend tag invalid: {blend_tag}",
        );

        let paint_off = packed.layer_headers[base + 7] as usize;
        let paint_len = packed.layer_headers[base + 8] as usize;
        assert!(
            paint_off + paint_len <= packed.paint_params.len(),
            "layer {layer_idx} paint range {paint_off}..+{paint_len} OOB",
        );

        let clip_off = packed.layer_headers[base + 9] as usize;
        let clip_count = packed.layer_headers[base + 10] as usize;
        assert!(
            (clip_off + clip_count) * CLIP_RECORD_U32S <= packed.clip_records.len(),
            "layer {layer_idx} clip range OOB",
        );
    }
}

#[test]
fn many_color_glyphs_extract_and_pack_without_panic() {
    let font = FontRef::new(COLRV1_FONT).expect("parse colrv1 font");
    let glyph_count = font.maxp().ok().map(|m| m.num_glyphs()).unwrap_or(0);
    let mut packed_any = false;
    for gid in 0..glyph_count.min(256) {
        if let Some(glyph) = extract_color_glyph(&font, GlyphId::new(gid as u32)) {
            let _ = pack_color_glyph(&glyph);
            if !glyph.layers.is_empty() {
                packed_any = true;
            }
        }
    }
    assert!(packed_any, "no paintable COLRv1 glyphs found in fixture");
}
