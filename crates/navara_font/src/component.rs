use bevy_ecs::component::Component;

/// Status of a font loading/processing operation.
#[derive(Debug, Clone, PartialEq, Default)]
pub enum FontStatus {
    #[default]
    Pending,
    Loading,
    Ready,
    Failed,
}

/// A request to render text on the globe.
///
/// Attach this component to an entity to request text rendering.
/// The system will fetch the font (if needed), generate the SDF atlas,
/// and produce shaping info for the TypeScript side to render.
#[derive(Debug, Clone, Component)]
pub struct FontRequest {
    /// URL of the font file (.ttf)
    pub font_url: String,
    /// The text string to render
    pub text: String,
    /// Font size in pixels (affects SDF generation)
    pub font_size: f64,
    /// WGS84 longitude in degrees
    pub lng: f64,
    /// WGS84 latitude in degrees
    pub lat: f64,
    /// Current status of this request
    pub status: FontStatus,
}

/// Shaped glyph data for a single character, sent to the TypeScript side.
///
/// Contains the glyph ID (index into the SDF atlas) and positioning
/// info from harfbuzz shaping.
#[derive(Debug, Clone, Component)]
pub struct ShapingResult {
    pub glyphs: Vec<ShapedGlyph>,
}

/// A single shaped glyph with positioning info from harfbuzz.
#[derive(Debug, Clone)]
pub struct ShapedGlyph {
    /// Glyph ID in the font (also used to look up atlas rect)
    pub glyph_id: u32,
    /// Horizontal advance after this glyph (in font units)
    pub x_advance: i32,
    /// Vertical advance after this glyph (in font units)
    pub y_advance: i32,
    /// Horizontal offset before drawing (in font units)
    pub x_offset: i32,
    /// Vertical offset before drawing (in font units)
    pub y_offset: i32,
    /// Index into the original text string (cluster)
    pub cluster: u32,
}
