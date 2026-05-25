//! End-to-end tests for the COLRv1 color glyph path.
//!
//! Covers Phases 1-4 of the color emoji pipeline:
//! - color font detection (`detect_colr_v1` via `FontCache::load_font`)
//! - color glyph rasterization (`color_raster::rasterize_color_glyph`)
//! - color atlas packing (`ColorAtlas::ensure_glyphs_in_atlas`)
//! - cache wiring (a color font gets a `ColorAtlas` allocated; a monochrome
//!   font does not)

use navara_wasm_font_worker::{
    atlas::AtlasMode,
    cache::FontCache,
    color_atlas::ColorAtlas,
    color_raster::{COLOR_GLYPH_PX_SIZE, rasterize_color_glyph},
};

const COLRV1_FONT: &[u8] = include_bytes!("fixtures/colrv1_test.ttf");
const MONO_FONT: &[u8] = include_bytes!("fixtures/demo_monochrome.ttf");

const COLRV1_URL: &str = "fixture://colrv1_test.ttf";
const MONO_URL: &str = "fixture://demo_monochrome.ttf";

/// Load a font into a fresh cache. Returns the cache.
fn cache_with(font_url: &str, bytes: &[u8]) -> FontCache {
    let mut cache = FontCache::default();
    cache
        .load_font(font_url.to_owned(), bytes.to_vec(), None, AtlasMode::Sdf)
        .expect("load_font");
    cache
}

#[test]
fn detects_colrv1_font_on_load() {
    let cache = cache_with(COLRV1_URL, COLRV1_FONT);
    let entry = cache.get(COLRV1_URL).expect("entry missing");
    assert!(entry.is_color, "fixture is a COLRv1 font");
    assert!(
        cache.get_color_atlas(COLRV1_URL).is_some(),
        "color atlas should be allocated for COLRv1 fonts",
    );
}

#[test]
fn monochrome_font_is_not_color() {
    let cache = cache_with(MONO_URL, MONO_FONT);
    let entry = cache.get(MONO_URL).expect("entry missing");
    assert!(!entry.is_color, "demo font has no COLR table");
    assert!(
        cache.get_color_atlas(MONO_URL).is_none(),
        "monochrome fonts should not allocate a color atlas",
    );
}

/// Walk the cmap of the COLRv1 fixture and grab any glyph_id whose COLRv1
/// painter actually produces pixels. The fixture contains several test glyphs;
/// the first non-empty bitmap is enough to verify the path works.
fn first_renderable_color_glyph(font_bytes: &[u8]) -> Option<u32> {
    for gid in 1..50u32 {
        if let Some(bmp) = rasterize_color_glyph(font_bytes, gid, COLOR_GLYPH_PX_SIZE)
            && bmp.width > 0
            && bmp.height > 0
            && bmp.rgba.iter().any(|&b| b != 0)
        {
            return Some(gid);
        }
    }
    None
}

#[test]
fn rasterizes_at_least_one_color_glyph() {
    let gid = first_renderable_color_glyph(COLRV1_FONT)
        .expect("fixture should have at least one paintable COLRv1 glyph");
    let bmp = rasterize_color_glyph(COLRV1_FONT, gid, COLOR_GLYPH_PX_SIZE)
        .expect("rasterize_color_glyph");
    assert!(bmp.width > 0);
    assert!(bmp.height > 0);
    assert_eq!(
        bmp.rgba.len(),
        (bmp.width * bmp.height * 4) as usize,
        "RGBA buffer must match dimensions",
    );
}

#[test]
fn rasterize_returns_none_for_unknown_glyph_id() {
    // Very high glyph IDs are unlikely to exist in a 21KB test font.
    assert!(rasterize_color_glyph(COLRV1_FONT, 9999, COLOR_GLYPH_PX_SIZE).is_none());
}

#[test]
fn rasterize_returns_none_for_monochrome_font() {
    // The demo font has no COLR table, so no glyph has a COLRv1 entry.
    assert!(rasterize_color_glyph(MONO_FONT, 1, COLOR_GLYPH_PX_SIZE).is_none());
}

#[test]
fn color_atlas_packs_glyphs_and_tracks_lru() {
    let gid = first_renderable_color_glyph(COLRV1_FONT)
        .expect("fixture should have at least one paintable COLRv1 glyph");

    let mut atlas = ColorAtlas::default();
    let added = atlas.ensure_glyphs_in_atlas(COLRV1_FONT, 0, &[gid], 0);
    assert!(added, "first call should report new glyphs added");

    let key = gid as u64; // composite_key(font_index=0, gid)
    let metrics = atlas
        .get_metrics(key)
        .expect("metrics for newly packed glyph");
    assert!(metrics.atlas_w > 0 && metrics.atlas_h > 0);

    // Calling again with the same id is idempotent (atlas unchanged).
    let added_again = atlas.ensure_glyphs_in_atlas(COLRV1_FONT, 0, &[gid], 1);
    assert!(!added_again, "no new glyphs on repeat call");

    // LRU should record the latest frame for the repeat call.
    assert_eq!(atlas.last_used.get(&key), Some(&1));
}
