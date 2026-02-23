use guillotiere::Size;

use crate::resource::{GlyphMetrics, SdfAtlas, SDF_PX_SIZE};

/// Generate an SDF image for a single glyph using fontsdf.
///
/// Returns the SDF pixel data (single-channel grayscale) and the glyph metrics.
pub fn generate_glyph_sdf(
    font: &fontsdf::Font,
    character: char,
) -> Option<(fontsdf::Metrics, Vec<u8>)> {
    let (metrics, sdf_data) = font.rasterize_sdf(character, SDF_PX_SIZE);

    if metrics.width == 0 || metrics.height == 0 {
        return None;
    }

    Some((metrics, sdf_data))
}

/// Generate SDF atlas entries for all glyphs needed by a text string.
///
/// For each unique character, generates the SDF and packs it into the atlas.
/// Skips glyphs that are already present in the atlas.
pub fn populate_atlas_for_text(
    font: &fontsdf::Font,
    text: &str,
    atlas: &mut SdfAtlas,
) {
    // Collect unique characters
    let mut chars: Vec<char> = text.chars().collect();
    chars.sort();
    chars.dedup();

    for ch in chars {
        let glyph_index = font.lookup_glyph_index(ch);

        // Skip glyphs already in the atlas
        if atlas.glyph_map.contains_key(&glyph_index) {
            continue;
        }

        let Some((metrics, sdf_data)) = generate_glyph_sdf(font, ch) else {
            bevy_log::warn!("Failed to generate SDF for character '{}'", ch);
            continue;
        };

        // Allocate space in the atlas
        let alloc = atlas
            .allocator
            .allocate(Size::new(metrics.width as i32, metrics.height as i32));

        let Some(alloc) = alloc else {
            bevy_log::warn!(
                "Atlas full: could not allocate {}x{} for '{}'",
                metrics.width,
                metrics.height,
                ch,
            );
            continue;
        };

        let rect = alloc.rectangle;
        let atlas_x = rect.min.x;
        let atlas_y = rect.min.y;

        // Copy single-channel SDF data into the RGBA atlas pixel buffer
        for y in 0..metrics.height {
            for x in 0..metrics.width {
                let src_idx = y * metrics.width + x;
                let dst_x = atlas_x as usize + x;
                let dst_y = atlas_y as usize + y;
                let dst_idx = (dst_y * atlas.width as usize + dst_x) * 4;

                if src_idx < sdf_data.len() && dst_idx + 3 < atlas.pixel_data.len() {
                    let v = sdf_data[src_idx];
                    atlas.pixel_data[dst_idx] = v;
                    atlas.pixel_data[dst_idx + 1] = v;
                    atlas.pixel_data[dst_idx + 2] = v;
                    atlas.pixel_data[dst_idx + 3] = 255;
                }
            }
        }

        atlas.glyph_map.insert(
            glyph_index,
            GlyphMetrics {
                alloc_id: alloc.id,
                atlas_x,
                atlas_y,
                atlas_w: metrics.width as u32,
                atlas_h: metrics.height as u32,
                bearing_x: metrics.xmin as f32,
                bearing_y: metrics.ymin as f32,
                advance: metrics.advance_width,
            },
        );
    }
}
