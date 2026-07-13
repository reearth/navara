use crate::atlas::{Atlas, AtlasMode, DEFAULT_ATLAS_SIZE, DEFAULT_COLOR_ATLAS_SIZE};
use skrifa::{FontRef, raw::TableProvider};
use std::collections::HashMap as StdHashMap;
use wasm_bindgen::prelude::*;

/// True if the font has a COLRv1 BaseGlyphList. Pure COLRv0 / CBDT / sbix
/// fonts are treated as monochrome and fall back to fontdue outlines.
fn detect_colr_v1(data: &[u8]) -> bool {
    let Ok(font) = FontRef::new(data) else {
        return false;
    };
    let Ok(colr) = font.colr() else {
        return false;
    };
    colr.base_glyph_list().is_some()
}

/// Merged, sorted `[from, to, from, to, ...]` codepoint ranges (inclusive)
/// from the font's unicode cmap subtables — the codepoints the font really
/// maps to glyphs. Empty when the face has no parsable unicode cmap, which
/// callers must treat as "unknown", not "covers nothing".
///
/// Computed once per file at load time so the TS FontManager can correct a
/// face's declared unicode ranges (stylesheet `unicode-range` boilerplate
/// can claim codepoints the file doesn't contain, which would shape as
/// tofu).
pub fn cmap_ranges(data: &[u8]) -> Vec<u32> {
    let Ok(face) = ttf_parser::Face::parse(data, 0) else {
        return Vec::new();
    };
    let Some(cmap) = face.tables().cmap else {
        return Vec::new();
    };
    let mut codepoints: Vec<u32> = Vec::new();
    for subtable in cmap.subtables {
        if !subtable.is_unicode() {
            continue;
        }
        subtable.codepoints(|cp| codepoints.push(cp));
    }
    codepoints.sort_unstable();
    codepoints.dedup();

    let mut ranges: Vec<u32> = Vec::new();
    for cp in codepoints {
        match ranges.last_mut() {
            Some(last) if *last + 1 == cp => *last = cp,
            _ => {
                ranges.push(cp);
                ranges.push(cp);
            }
        }
    }
    ranges
}

/// Decompress WOFF2/WOFF1 to raw TTF/OTF; pass-through for raw fonts.
fn maybe_decompress_font(data: Vec<u8>) -> Result<Vec<u8>, String> {
    if data.len() >= 4 {
        let tag = &data[..4];
        if tag == b"wOF2" {
            return wuff::decompress_woff2(&data)
                .map_err(|e| format!("Failed to decompress WOFF2: {:?}", e));
        }
        if tag == b"wOFF" {
            return wuff::decompress_woff1(&data)
                .map_err(|e| format!("Failed to decompress WOFF1: {:?}", e));
        }
    }
    Ok(data)
}

/// A loaded font. The atlas lives separately in `FontCache::atlases` so faces
/// from the same family can share one.
pub struct FontEntry {
    /// Raw font bytes (kept alive for rustybuzz references).
    pub data: Vec<u8>,
    pub raster_font: fontdue::Font,
    pub units_per_em: u16,
    /// Vertical line metrics (font units) for multi-line layout.
    pub line_metrics: crate::shaping::LineMetrics,
    /// Key into `FontCache::atlases`: family name for shared atlases, URL for
    /// standalone fonts.
    pub atlas_key: String,
    /// Unique index used in composite glyph keys, so two fonts sharing an
    /// atlas can't collide on the same glyph_id.
    pub font_index: u32,
    /// True for COLRv1 fonts — glyphs go to a parallel RGBA color atlas.
    pub is_color: bool,
}

/// Loaded fonts plus their atlases.
///
/// `atlases` and `color_atlases` use the same keys (family name or URL), so a
/// family mixing text and emoji gets one of each.
#[wasm_bindgen]
#[derive(Default)]
pub struct FontCache {
    #[wasm_bindgen(skip)]
    pub fonts: StdHashMap<String, FontEntry>,
    #[wasm_bindgen(skip)]
    pub atlases: StdHashMap<String, Atlas>,
    #[wasm_bindgen(skip)]
    pub color_atlases: StdHashMap<String, Atlas>,
    #[wasm_bindgen(skip)]
    pub next_font_index: u32,
}

impl FontCache {
    pub fn is_font_loaded(&self, url: &str) -> bool {
        self.fonts.contains_key(url)
    }

    pub fn get(&self, url: &str) -> Option<&FontEntry> {
        self.fonts.get(url)
    }

    /// Atlas key for a loaded font (family name or URL).
    pub fn get_atlas_key(&self, url: &str) -> Option<&str> {
        self.fonts.get(url).map(|e| e.atlas_key.as_str())
    }

    pub fn get_color_atlas(&self, atlas_key: &str) -> Option<&Atlas> {
        self.color_atlases.get(atlas_key)
    }

    /// Parse and store a font, creating its atlases if missing.
    ///
    /// `atlas_key`: if set, all fonts with the same key share one atlas
    /// (typically a family name). If `None`, the URL is used.
    ///
    /// `mode` picks the SDF vs MSDF path for the monochrome atlas. The TS
    /// layer exposes this as the `highQuality` boolean and qualifies
    /// `atlas_key` per quality so the two modes coexist. The first load under
    /// a given key fixes that atlas's mode.
    pub fn load_font(
        &mut self,
        url: String,
        data: Vec<u8>,
        atlas_key: Option<String>,
        mode: AtlasMode,
    ) -> Result<(), String> {
        let data = maybe_decompress_font(data)?;
        let raster_font =
            fontdue::Font::from_bytes(data.as_slice(), fontdue::FontSettings::default())
                .map_err(|e| format!("Failed to parse font with fontdue: {}", e))?;
        let units_per_em = crate::shaping::get_units_per_em(&data).unwrap_or(1000);
        // Fallback approximates typical hhea values when the face is unparsable
        // (ascender ≈ 0.8 em, descender ≈ -0.2 em).
        let line_metrics =
            crate::shaping::get_line_metrics(&data).unwrap_or(crate::shaping::LineMetrics {
                ascender: (units_per_em as i32 * 4 / 5) as i16,
                descender: -((units_per_em as i32 / 5) as i16),
                line_gap: 0,
            });
        let is_color = detect_colr_v1(&data);

        let atlas_key = atlas_key.unwrap_or_else(|| url.clone());

        self.atlases
            .entry(atlas_key.clone())
            .or_insert_with(|| Atlas::new(DEFAULT_ATLAS_SIZE, mode));
        if is_color {
            self.color_atlases
                .entry(atlas_key.clone())
                .or_insert_with(|| Atlas::new(DEFAULT_COLOR_ATLAS_SIZE, AtlasMode::Color));
        }

        let font_index = self.next_font_index;
        self.next_font_index += 1;

        self.fonts.insert(
            url,
            FontEntry {
                data,
                raster_font,
                units_per_em,
                line_metrics,
                atlas_key,
                font_index,
                is_color,
            },
        );
        Ok(())
    }

    /// The atlas (SDF or color) under `atlas_key` that holds `key`. A composite
    /// key lives in at most one of the two (a font is either color or
    /// monochrome), so the SDF atlas wins only when it actually contains the
    /// key; otherwise the color atlas is returned as the fallback owner.
    fn atlas_with_key_mut(&mut self, atlas_key: &str, key: u64) -> Option<&mut Atlas> {
        if self.atlases.get(atlas_key).is_some_and(|a| a.contains(key)) {
            return self.atlases.get_mut(atlas_key);
        }
        self.color_atlases.get_mut(atlas_key)
    }

    /// Add one visible-label reference to each glyph under `atlas_key`.
    pub fn retain_glyphs(&mut self, atlas_key: &str, keys: &[u64]) {
        for &key in keys {
            if let Some(atlas) = self.atlas_with_key_mut(atlas_key, key) {
                atlas.retain(key);
            }
        }
    }

    /// Drop one visible-label reference from each glyph under `atlas_key`.
    pub fn release_glyphs(&mut self, atlas_key: &str, keys: &[u64]) {
        for &key in keys {
            if let Some(atlas) = self.atlas_with_key_mut(atlas_key, key) {
                atlas.release(key);
            }
        }
    }

    /// Remove a font. Frees its atlases only if no other font still uses them.
    pub fn unload_font(&mut self, url: &str) -> Result<(), String> {
        let entry = self
            .fonts
            .remove(url)
            .ok_or_else(|| format!("Font not found: {}", url))?;

        let still_referenced = self.fonts.values().any(|e| e.atlas_key == entry.atlas_key);
        if !still_referenced {
            self.atlases.remove(&entry.atlas_key);
            self.color_atlases.remove(&entry.atlas_key);
        }

        Ok(())
    }
}
