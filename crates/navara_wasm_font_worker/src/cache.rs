use crate::atlas::SDFAtlas;
use std::collections::HashMap as StdHashMap;
use wasm_bindgen::prelude::*;

/// Number of frames a glyph must be unused before it becomes evictable.
pub const LRU_MIN_AGE: u64 = 120;

/// A loaded font with its own SDF atlas.
pub struct FontEntry {
    /// Raw font file bytes (kept alive for rustybuzz references)
    pub data: Vec<u8>,
    /// Parsed fontdue font (for bitmap rasterization by glyph ID)
    pub raster_font: fontdue::Font,
    /// Per-font SDF atlas
    pub atlas: SDFAtlas,
    /// Used for converting font units to pixels
    pub units_per_em: u16,
}

/// Cache of loaded fonts, keyed by URL.
///
/// Each font entry owns its own SDF atlas so that different fonts
/// don't compete for atlas space and the TypeScript side can receive
/// a single atlas texture per font.
#[wasm_bindgen]
#[derive(Default)]
pub struct FontCache {
    #[wasm_bindgen(skip)]
    pub fonts: StdHashMap<String, FontEntry>,
    #[wasm_bindgen(skip)]
    pub current_frame: u64,
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

    /// Store a newly loaded font. Parses the font data and creates a fresh atlas.
    pub fn load_font(&mut self, url: String, data: Vec<u8>) -> Result<(), String> {
        let raster_font =
            fontdue::Font::from_bytes(data.as_slice(), fontdue::FontSettings::default())
                .map_err(|e| format!("Failed to parse font with fontdue: {}", e))?;
        let units_per_em = crate::shaping::get_units_per_em(&data).unwrap_or(1000);
        self.fonts.insert(
            url,
            FontEntry {
                data,
                raster_font,
                atlas: SDFAtlas::default(),
                units_per_em,
            },
        );
        Ok(())
    }

    /// Remove a font from the cache, freeing its atlas memory.
    pub fn unload_font(&mut self, url: &str) -> Result<(), String> {
        self.fonts
            .remove(url)
            .ok_or_else(|| format!("Font not found: {}", url))?;
        Ok(())
    }
}
