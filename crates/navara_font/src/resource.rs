use bevy_ecs::resource::Resource;
use guillotiere::{AllocId, AtlasAllocator, Size};
use rustc_hash::FxHashMap;

/// Default SDF atlas dimensions (width x height in pixels).
pub const DEFAULT_ATLAS_SIZE: i32 = 1024;

/// Font size in pixels used for SDF rasterization.
/// A single SDF glyph at this size can render both small and large text.
pub const SDF_PX_SIZE: f32 = 64.0;

/// Metrics for a single glyph in the SDF atlas.
#[derive(Debug, Clone)]
pub struct GlyphMetrics {
    /// Allocation ID in the atlas (for potential deallocation)
    pub alloc_id: AllocId,
    /// X position of the glyph in the atlas (pixels)
    pub atlas_x: i32,
    /// Y position of the glyph in the atlas (pixels)
    pub atlas_y: i32,
    /// Width of the glyph region in the atlas (pixels)
    pub atlas_w: u32,
    /// Height of the glyph region in the atlas (pixels)
    pub atlas_h: u32,
    /// Horizontal bearing (offset from cursor to glyph left edge)
    pub bearing_x: f32,
    /// Vertical bearing (offset from baseline to glyph bottom edge)
    pub bearing_y: f32,
    /// Horizontal advance width
    pub advance: f32,
}

/// The SDF texture atlas for a loaded font.
///
/// Manages rectangle packing via guillotiere and stores per-glyph metrics
/// so the TypeScript side knows where each glyph lives in the atlas texture.
#[derive(Resource)]
pub struct SdfAtlas {
    /// Rectangle packer for allocating glyph regions
    pub allocator: AtlasAllocator,
    /// Raw RGBA pixel data of the atlas texture
    pub pixel_data: Vec<u8>,
    /// Atlas width in pixels
    pub width: u32,
    /// Atlas height in pixels
    pub height: u32,
    /// Map from glyph index to its metrics/position in the atlas
    pub glyph_map: FxHashMap<u16, GlyphMetrics>,
}

impl Default for SdfAtlas {
    fn default() -> Self {
        let size = DEFAULT_ATLAS_SIZE;
        Self {
            allocator: AtlasAllocator::new(Size::new(size, size)),
            pixel_data: vec![0u8; (size * size * 4) as usize],
            width: size as u32,
            height: size as u32,
            glyph_map: FxHashMap::default(),
        }
    }
}

/// A loaded font stored in the cache.
pub struct LoadedFont {
    /// Raw font file bytes (kept alive for rustybuzz references)
    pub data: Vec<u8>,
    /// Parsed fontsdf font (for SDF rasterization)
    pub sdf_font: fontsdf::Font,
}

/// Cache of loaded fonts, keyed by URL.
///
/// Prevents re-fetching and re-parsing the same font file.
/// Also tracks which font is currently active (has its atlas generated).
#[derive(Default, Resource)]
pub struct FontCache {
    /// Loaded fonts keyed by their URL
    pub fonts: FxHashMap<String, LoadedFont>,
    /// URL of the currently active font (the one with a generated SDF atlas)
    pub active_font_url: Option<String>,
}

impl FontCache {
    /// Check if a font is already loaded by URL.
    pub fn is_loaded(&self, url: &str) -> bool {
        self.fonts.contains_key(url)
    }

    /// Get a loaded font by URL.
    pub fn get(&self, url: &str) -> Option<&LoadedFont> {
        self.fonts.get(url)
    }

    /// Store a newly loaded font. Parses the font data for both SDF and shaping.
    pub fn insert(&mut self, url: String, data: Vec<u8>) -> Result<(), &'static str> {
        let sdf_font = fontsdf::Font::from_bytes(&data)?;
        self.fonts.insert(url, LoadedFont { data, sdf_font });
        Ok(())
    }
}
