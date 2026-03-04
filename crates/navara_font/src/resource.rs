use guillotiere::{AllocId, AtlasAllocator, Size};
use rustc_hash::FxHashMap;

/// Default SDF atlas dimensions (width x height in pixels).
pub const DEFAULT_ATLAS_SIZE: i32 = 1024 * 2;

/// Font size in pixels used for SDF rasterization.
/// A single SDF glyph at this size can render both small and large text.
pub const SDF_PX_SIZE: f32 = 64.0;

/// Number of frames a glyph must be unused before it becomes evictable.
pub const LRU_MIN_AGE: u64 = 120;

/// Metrics for a single glyph in the SDF atlas.
#[derive(Debug, Clone)]
pub struct GlyphMetrics {
    /// Allocation ID in the atlas (for deallocation during LRU eviction)
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

/// Per-font SDF texture atlas.
///
/// Each loaded font gets its own atlas. Glyphs are keyed by glyph ID
/// (post-shaping, not Unicode codepoint) so that contextual forms
/// (Arabic positional variants, ligatures, etc.) are stored correctly.
pub struct SDFAtlas {
    /// Rectangle packer for allocating glyph regions
    pub allocator: AtlasAllocator,
    /// Raw single-channel SDF pixel data of the atlas texture
    pub pixel_data: Vec<u8>,
    /// Atlas width in pixels
    pub width: u32,
    /// Atlas height in pixels
    pub height: u32,
    /// Map from glyph ID (post-shaping) to its metrics/position in the atlas
    pub glyph_map: FxHashMap<u16, GlyphMetrics>,
    /// LRU tracking: glyph ID → last frame the glyph was used
    pub last_used: FxHashMap<u16, u64>,
}

impl SDFAtlas {
    pub fn new(size: i32) -> Self {
        Self {
            allocator: AtlasAllocator::new(Size::new(size, size)),
            pixel_data: vec![0u8; (size * size) as usize],
            width: size as u32,
            height: size as u32,
            glyph_map: FxHashMap::default(),
            last_used: FxHashMap::default(),
        }
    }

    /// Mark a glyph as used this frame (for LRU tracking).
    pub fn touch(&mut self, glyph_id: u16, current_frame: u64) {
        self.last_used.insert(glyph_id, current_frame);
    }

    /// Check if a glyph is already in the atlas.
    pub fn contains(&self, glyph_id: u16) -> bool {
        self.glyph_map.contains_key(&glyph_id)
    }
}

impl Default for SDFAtlas {
    fn default() -> Self {
        Self::new(DEFAULT_ATLAS_SIZE)
    }
}

/// A loaded font with its own SDF atlas.
pub struct FontEntry {
    /// Raw font file bytes (kept alive for rustybuzz references)
    pub data: Vec<u8>,
    /// Parsed fontsdf font (for SDF rasterization by glyph ID)
    pub sdf_font: fontsdf::Font,
    /// Per-font SDF atlas
    pub atlas: SDFAtlas,
    /// Cached units-per-em (parsed once at load time)
    pub units_per_em: u16,
}

/// Cache of loaded fonts, keyed by URL.
///
/// Each font entry owns its own SDF atlas so that different fonts
/// don't compete for atlas space and the TypeScript side can receive
/// a single atlas texture per font.
#[derive(Default)]
#[cfg_attr(feature = "bevy", derive(bevy_ecs::resource::Resource))]
pub struct FontCache {
    /// Loaded fonts keyed by their URL
    pub fonts: FxHashMap<String, FontEntry>,
    /// Frame counter for LRU tracking (incremented each update cycle)
    pub current_frame: u64,
}

impl FontCache {
    pub fn is_loaded(&self, url: &str) -> bool {
        self.fonts.contains_key(url)
    }

    pub fn get(&self, url: &str) -> Option<&FontEntry> {
        self.fonts.get(url)
    }

    pub fn get_mut(&mut self, url: &str) -> Option<&mut FontEntry> {
        self.fonts.get_mut(url)
    }

    /// Store a newly loaded font. Parses the font data and creates a fresh atlas.
    pub fn insert(&mut self, url: String, data: Vec<u8>) -> Result<(), &'static str> {
        let sdf_font = fontsdf::Font::from_bytes(&data)?;
        let units_per_em = crate::shaping::get_units_per_em(&data).unwrap_or(1000);
        self.fonts.insert(
            url,
            FontEntry {
                data,
                sdf_font,
                atlas: SDFAtlas::default(),
                units_per_em,
            },
        );
        Ok(())
    }
}
