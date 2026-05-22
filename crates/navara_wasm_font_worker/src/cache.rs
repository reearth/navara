use crate::atlas::SDFAtlas;
use crate::color_atlas::ColorAtlas;
use skrifa::{FontRef, raw::TableProvider};
use std::collections::HashMap as StdHashMap;
use wasm_bindgen::prelude::*;

/// Detect whether the font contains a COLRv1 paint graph we can render.
///
/// A font is considered a color font for our pipeline only if it has a COLR
/// table with a v1 BaseGlyphList. Pure COLRv0 fonts and bitmap color formats
/// (CBDT/sbix) are treated as monochrome — they will still render via fontdue
/// using whatever outline fallbacks exist.
fn detect_colr_v1(data: &[u8]) -> bool {
    let Ok(font) = FontRef::new(data) else {
        return false;
    };
    let Ok(colr) = font.colr() else {
        return false;
    };
    colr.base_glyph_list().is_some()
}

/// Detect WOFF2/WOFF1 by magic bytes and decompress to raw TTF/OTF.
/// Returns the data unchanged if it is already a raw font.
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

/// Number of ticks a glyph must be unused before it becomes evictable.
/// One tick corresponds to one `prepareTextBatch` call (see [`FontCache::tick`]
/// in `lib.rs`), not one rendered frame — batches only fire when new text is
/// requested, so a small value here is needed for eviction to actually kick in
/// before the atlas grows. A glyph not touched by the last 5 batches is cold.
pub const LRU_MIN_AGE: u64 = 5;

/// A loaded font entry. The SDF atlas is stored separately in `FontCache::atlases`
/// so that multiple fonts belonging to the same family can share one atlas.
pub struct FontEntry {
    /// Raw font file bytes (kept alive for rustybuzz references)
    pub data: Vec<u8>,
    /// Parsed fontdue font (for bitmap rasterization by glyph ID)
    pub raster_font: fontdue::Font,
    /// Used for converting font units to pixels
    pub units_per_em: u16,
    /// Key into `FontCache::atlases`. For standalone fonts this equals the URL;
    /// for font-family faces this equals the family name so all faces share one atlas.
    pub atlas_key: String,
    /// Unique index for this font within a shared atlas. Used to build composite
    /// glyph keys so that different fonts' glyph IDs don't collide.
    pub font_index: u32,
    /// True if the font has a COLRv1 paint graph and should be rendered through
    /// the color glyph pipeline instead of the SDF pipeline.
    pub is_color: bool,
}

/// Cache of loaded fonts, keyed by URL.
///
/// Atlases are stored in a separate map keyed by "atlas key" so that:
/// - Standalone font URLs each get their own atlas (atlas_key == url).
/// - Font-family faces share a single atlas (atlas_key == family name).
#[wasm_bindgen]
#[derive(Default)]
pub struct FontCache {
    #[wasm_bindgen(skip)]
    pub fonts: StdHashMap<String, FontEntry>,
    #[wasm_bindgen(skip)]
    pub atlases: StdHashMap<String, SDFAtlas>,
    /// Parallel atlases for COLRv1 color glyphs. Keyed identically to `atlases`
    /// so a font family that mixes text and emoji faces gets one of each.
    #[wasm_bindgen(skip)]
    pub color_atlases: StdHashMap<String, ColorAtlas>,
    /// Logical LRU clock. Incremented once per `prepareTextBatch` call via
    /// [`FontCache::tick`]; **not** a rendered-frame counter.
    #[wasm_bindgen(skip)]
    pub tick: u64,
    /// Counter for assigning unique font indices (used in composite atlas keys).
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

    pub fn get_mut(&mut self, url: &str) -> Option<&mut FontEntry> {
        self.fonts.get_mut(url)
    }

    /// Get the atlas key for a loaded font (family name or URL).
    pub fn get_atlas_key(&self, url: &str) -> Option<&str> {
        self.fonts.get(url).map(|e| e.atlas_key.as_str())
    }

    /// Get an immutable reference to an atlas by its key.
    pub fn get_atlas(&self, atlas_key: &str) -> Option<&SDFAtlas> {
        self.atlases.get(atlas_key)
    }

    /// Get a mutable reference to an atlas by its key.
    pub fn get_atlas_mut(&mut self, atlas_key: &str) -> Option<&mut SDFAtlas> {
        self.atlases.get_mut(atlas_key)
    }

    /// Get an immutable reference to a color atlas by its key.
    pub fn get_color_atlas(&self, atlas_key: &str) -> Option<&ColorAtlas> {
        self.color_atlases.get(atlas_key)
    }

    /// Get a mutable reference to a color atlas by its key.
    pub fn get_color_atlas_mut(&mut self, atlas_key: &str) -> Option<&mut ColorAtlas> {
        self.color_atlases.get_mut(atlas_key)
    }

    /// Store a newly loaded font. Parses the font data and creates or reuses an atlas.
    ///
    /// `atlas_key`: if `Some`, the font shares an atlas with other fonts under the same key
    /// (e.g. a font family name). If `None`, the font gets its own atlas keyed by URL.
    pub fn load_font(
        &mut self,
        url: String,
        data: Vec<u8>,
        atlas_key: Option<String>,
    ) -> Result<(), String> {
        let data = maybe_decompress_font(data)?;
        let raster_font =
            fontdue::Font::from_bytes(data.as_slice(), fontdue::FontSettings::default())
                .map_err(|e| format!("Failed to parse font with fontdue: {}", e))?;
        let units_per_em = crate::shaping::get_units_per_em(&data).unwrap_or(1000);
        let is_color = detect_colr_v1(&data);

        let atlas_key = atlas_key.unwrap_or_else(|| url.clone());

        // Create the atlas if it doesn't exist yet (first face in the family, or standalone font)
        self.atlases.entry(atlas_key.clone()).or_default();
        if is_color {
            self.color_atlases.entry(atlas_key.clone()).or_default();
        }

        let font_index = self.next_font_index;
        self.next_font_index += 1;

        self.fonts.insert(
            url,
            FontEntry {
                data,
                raster_font,
                units_per_em,
                atlas_key,
                font_index,
                is_color,
            },
        );
        Ok(())
    }

    /// Remove a font from the cache. Frees the atlas only when no other fonts reference it.
    pub fn unload_font(&mut self, url: &str) -> Result<(), String> {
        let entry = self
            .fonts
            .remove(url)
            .ok_or_else(|| format!("Font not found: {}", url))?;

        // Check if any other font still references this atlas key
        let still_referenced = self.fonts.values().any(|e| e.atlas_key == entry.atlas_key);

        if !still_referenced {
            self.atlases.remove(&entry.atlas_key);
            self.color_atlases.remove(&entry.atlas_key);
        }

        Ok(())
    }
}
