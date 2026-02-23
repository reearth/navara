use crate::component::ShapedGlyph;

/// Shape a text string using rustybuzz (harfbuzz port).
///
/// Returns positioned glyph info that the TypeScript side uses
/// to place instanced rect meshes for each character.
pub fn shape_text(font_data: &[u8], text: &str) -> Option<Vec<ShapedGlyph>> {
    let face = rustybuzz::Face::from_slice(font_data, 0)?;

    let mut buffer = rustybuzz::UnicodeBuffer::new();
    buffer.push_str(text);

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

    Some(glyphs)
}
