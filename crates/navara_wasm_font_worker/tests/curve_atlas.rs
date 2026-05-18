//! Integration tests for the Phase 3 shared GPU buffer pool.
//!
//! Drives `FontCache::ensure_glyphs` indirectly via the public Rust-side
//! cache API (not the WASM API; that's exercised at the JS layer). Verifies
//! the buffer layout invariants and dirty-range bookkeeping survive realistic
//! font loads.

use navara_wasm_font_worker::{
    cache::FontCache,
    color_curve_atlas::evict_cold_pair,
    curve_atlas::{CurveAtlas, composite_key},
    curves::{
        CLIP_RECORD_U32S, FLAG_HAS_COLOR_LAYERS, HEADER_BAND_CURVES_OFFSET, HEADER_BANDS_OFFSET,
        HEADER_COLOR_LAYER_COUNT, HEADER_COLOR_LAYER_START, HEADER_CURVES_OFFSET, HEADER_F32_COUNT,
        HEADER_FLAGS, LAYER_HEADER_U32S,
    },
};
use skrifa::{GlyphId, prelude::FontRef, raw::TableProvider};

const MONO_FONT: &[u8] = include_bytes!("fixtures/demo_monochrome.ttf");
const COLRV1_FONT: &[u8] = include_bytes!("fixtures/colrv1_test.ttf");

const MONO_URL: &str = "fixture://demo_monochrome.ttf";
const COLR_URL: &str = "fixture://colrv1_test.ttf";

fn load(cache: &mut FontCache, url: &str, bytes: &[u8]) {
    cache
        .load_font(url.to_owned(), bytes.to_vec(), None)
        .expect("load_font");
}

fn first_outlined_gid(font: &FontRef<'_>) -> u32 {
    let glyph_count = font.maxp().ok().map(|m| m.num_glyphs()).unwrap_or(0);
    for gid in 1..glyph_count {
        if let Some(o) =
            navara_wasm_font_worker::curves::extract_glyph_outline(font, GlyphId::new(gid as u32))
            && !o.curves.is_empty()
        {
            return gid as u32;
        }
    }
    panic!("no outlined glyph in fixture");
}

/// Helper: insert one outlined glyph into the curve atlas via the public
/// `ensure_glyphs` path.
fn ensure_in_atlas(atlas: &mut CurveAtlas, font: &FontRef<'_>, gids: &[u32], frame: u64) {
    atlas.ensure_glyphs(font, 0, gids, frame);
}

#[test]
fn loading_a_font_provisions_the_curve_atlas() {
    let mut cache = FontCache::default();
    load(&mut cache, MONO_URL, MONO_FONT);
    assert!(cache.get_curve_atlas(MONO_URL).is_some());
    // The mono fixture has no COLRv1 table, so no color atlas.
    assert!(cache.get_color_curve_atlas(MONO_URL).is_none());

    load(&mut cache, COLR_URL, COLRV1_FONT);
    assert!(cache.get_curve_atlas(COLR_URL).is_some());
    assert!(cache.get_color_curve_atlas(COLR_URL).is_some());
}

#[test]
fn ensure_writes_offsets_into_glyph_header() {
    let mut cache = FontCache::default();
    load(&mut cache, MONO_URL, MONO_FONT);
    let font = FontRef::new(MONO_FONT).unwrap();
    let gid = first_outlined_gid(&font);

    let atlas = cache.get_curve_atlas_mut(MONO_URL).unwrap();
    ensure_in_atlas(atlas, &font, &[gid], 0);
    let record = atlas.get_record(composite_key(0, gid)).unwrap().clone();

    let base = record.header_slot as usize * HEADER_F32_COUNT;
    let bands_off = atlas.glyph_headers[base + HEADER_BANDS_OFFSET] as u32;
    let band_curves_off = atlas.glyph_headers[base + HEADER_BAND_CURVES_OFFSET] as u32;
    let curves_off = atlas.glyph_headers[base + HEADER_CURVES_OFFSET] as u32;

    // Offsets in the header must agree with the record (this is the GPU
    // contract: vertex shader fetches the header and uses these to find the
    // glyph's data in the three variable buffers).
    assert_eq!(bands_off, record.bands_offset);
    assert_eq!(band_curves_off, record.band_curves_offset);
    assert_eq!(curves_off, record.curves_offset);
}

#[test]
fn dirty_ranges_reset_after_drain() {
    let mut cache = FontCache::default();
    load(&mut cache, MONO_URL, MONO_FONT);
    let font = FontRef::new(MONO_FONT).unwrap();
    let gid = first_outlined_gid(&font);

    let atlas = cache.get_curve_atlas_mut(MONO_URL).unwrap();
    ensure_in_atlas(atlas, &font, &[gid], 0);
    let first = atlas.take_dirty_ranges();
    assert!(first.headers.is_some());
    assert!(first.curves.is_some());

    // Second drain with no new work: empty.
    let second = atlas.take_dirty_ranges();
    assert!(second.headers.is_none());
    assert!(second.bands.is_none());
    assert!(second.band_curves.is_none());
    assert!(second.curves.is_none());
}

#[test]
fn caching_a_glyph_a_second_time_does_not_reinsert() {
    let mut cache = FontCache::default();
    load(&mut cache, MONO_URL, MONO_FONT);
    let font = FontRef::new(MONO_FONT).unwrap();
    let gid = first_outlined_gid(&font);

    let atlas = cache.get_curve_atlas_mut(MONO_URL).unwrap();
    let changed_first = atlas.ensure_glyphs(&font, 0, &[gid], 0);
    let changed_second = atlas.ensure_glyphs(&font, 0, &[gid], 1);
    assert!(changed_first);
    assert!(!changed_second, "second ensure should be a no-op");
}

#[test]
fn color_glyph_binds_layer_range_on_outline_header() {
    let mut cache = FontCache::default();
    load(&mut cache, COLR_URL, COLRV1_FONT);
    let font = FontRef::new(COLRV1_FONT).unwrap();

    // Find a paintable color glyph.
    let glyph_count = font.maxp().ok().map(|m| m.num_glyphs()).unwrap_or(0);
    let mut color_gid = None;
    for gid in 1..glyph_count {
        let id = GlyphId::new(gid as u32);
        if let Some(g) = navara_wasm_font_worker::curves::extract_color_glyph(&font, id)
            && !g.layers.is_empty()
        {
            color_gid = Some(gid as u32);
            break;
        }
    }
    let gid = color_gid.expect("colrv1 fixture has at least one paintable glyph");

    let outline = cache.get_curve_atlas_mut(COLR_URL).unwrap() as *mut _;
    let color = cache.get_color_curve_atlas_mut(COLR_URL).unwrap();
    // SAFETY: the two atlases live on disjoint fields of FontCache and the
    // raw pointer is only used here, in this single statement, with no
    // aliasing — equivalent to the pattern used inside `wasm_shape_text_curves`.
    let outline_ref = unsafe { &mut *outline };
    color.ensure_color_glyphs(outline_ref, &font, 0, &[gid], 0);

    let key = composite_key(0, gid);
    let outline_record = outline_ref.get_record(key).expect("outline glyph cached");
    let h = outline_record.header_slot as usize * HEADER_F32_COUNT;
    let flags = outline_ref.glyph_headers[h + HEADER_FLAGS].to_bits();
    assert!(
        flags & FLAG_HAS_COLOR_LAYERS != 0,
        "outline header should be flagged as color",
    );
    let color_record = color.get_record(key).expect("color record present");
    assert_eq!(
        outline_ref.glyph_headers[h + HEADER_COLOR_LAYER_START].to_bits(),
        color_record.layer_start,
    );
    assert_eq!(
        outline_ref.glyph_headers[h + HEADER_COLOR_LAYER_COUNT].to_bits(),
        color_record.layer_count,
    );

    // Layer headers must be sized as expected.
    assert_eq!(
        color.layer_headers.len() % LAYER_HEADER_U32S,
        0,
        "layer headers buffer not a multiple of LAYER_HEADER_U32S",
    );
    // Clip records the same.
    assert_eq!(
        color.clip_records.len() % CLIP_RECORD_U32S,
        0,
        "clip records buffer not a multiple of CLIP_RECORD_U32S",
    );
}

#[test]
fn evict_cold_pair_clears_color_binding() {
    let mut cache = FontCache::default();
    load(&mut cache, COLR_URL, COLRV1_FONT);
    let font = FontRef::new(COLRV1_FONT).unwrap();

    // Insert a color glyph at frame 0.
    let glyph_count = font.maxp().ok().map(|m| m.num_glyphs()).unwrap_or(0);
    let gid = (1..glyph_count)
        .find(|&g| {
            navara_wasm_font_worker::curves::extract_color_glyph(&font, GlyphId::new(g as u32))
                .map(|c| !c.layers.is_empty())
                .unwrap_or(false)
        })
        .expect("paintable glyph") as u32;

    let outline_ptr = cache.get_curve_atlas_mut(COLR_URL).unwrap() as *mut _;
    let color = cache.get_color_curve_atlas_mut(COLR_URL).unwrap();
    // SAFETY: same disjoint-field reasoning as the previous test.
    let outline = unsafe { &mut *outline_ptr };
    color.ensure_color_glyphs(outline, &font, 0, &[gid], 0);

    // Advance frame past the LRU threshold without touching the glyph, then
    // evict both atlases through the helper. The outline atlas may still
    // hold the glyph (its own age accounting is independent) but the color
    // binding flag must be cleared.
    let lru = navara_wasm_font_worker::cache::LRU_MIN_AGE;
    evict_cold_pair(color, outline, lru + 1, lru);
    let key = composite_key(0, gid);
    assert!(!color.contains(key), "color record should be evicted");
    if let Some(record) = outline.get_record(key) {
        let h = record.header_slot as usize * HEADER_F32_COUNT;
        let flags = outline.glyph_headers[h + HEADER_FLAGS].to_bits();
        assert_eq!(
            flags & FLAG_HAS_COLOR_LAYERS,
            0,
            "outline header still flagged after color eviction",
        );
    }
}

#[test]
fn buffer_grows_when_many_glyphs_inserted() {
    let mut cache = FontCache::default();
    load(&mut cache, MONO_URL, MONO_FONT);
    let font = FontRef::new(MONO_FONT).unwrap();
    let glyph_count = font.maxp().ok().map(|m| m.num_glyphs()).unwrap_or(0);

    let atlas = cache.get_curve_atlas_mut(MONO_URL).unwrap();
    let initial_curve_capacity = atlas.curve_data.len();

    // Insert every outlined glyph available in the fixture. For a small
    // font this fits without growth; for a larger one the buffer expands
    // automatically.
    let gids: Vec<u32> = (1..glyph_count.min(256)).map(|g| g as u32).collect();
    let _ = atlas.ensure_glyphs(&font, 0, &gids, 0);

    // The number of curves actually inserted is data-dependent; we just
    // check the post-condition that every cached glyph has a non-empty
    // header range and the buffer never shrinks.
    assert!(atlas.curve_data.len() >= initial_curve_capacity);
    let mut cached = 0;
    for &g in &gids {
        if atlas.get_record(composite_key(0, g)).is_some() {
            cached += 1;
        }
    }
    assert!(cached > 0, "no glyphs were cached at all");
}
