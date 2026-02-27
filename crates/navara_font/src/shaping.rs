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

/// Get the units-per-em value from raw font data.
pub fn get_units_per_em(font_data: &[u8]) -> Option<u16> {
    let face = rustybuzz::Face::from_slice(font_data, 0)?;
    Some(face.units_per_em() as u16)
}

/// Shape a text string using rustybuzz (harfbuzz port).
///
/// Returns positioned glyph info and the font's units-per-em value.
/// The units-per-em is needed to convert font-unit advances/offsets to SDF pixel space.
pub fn shape_text(font_data: &[u8], text: &str) -> Option<(Vec<ShapedGlyph>, u16)> {
    let face = rustybuzz::Face::from_slice(font_data, 0)?;
    let units_per_em = face.units_per_em() as u16;

    let mut buffer = rustybuzz::UnicodeBuffer::new();
    buffer.push_str(text);
    buffer.guess_segment_properties();

    let output = rustybuzz::shape(&face, &[], buffer);

    let infos = output.glyph_infos();
    let positions = output.glyph_positions();

    let glyphs = infos
        .iter()
        .zip(positions.iter())
        .map(|(info, pos)| ShapedGlyph {
            glyph_id: info.glyph_id,
            x_advance: pos.x_advance,
            y_advance: pos.y_advance,
            x_offset: pos.x_offset,
            y_offset: pos.y_offset,
            cluster: info.cluster,
        })
        .collect();

    Some((glyphs, units_per_em))
}
