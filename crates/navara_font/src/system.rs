use bevy_ecs::entity::Entity;
use bevy_ecs::query::{Added, Changed, With};
use bevy_ecs::system::{Commands, Query, Res, ResMut};

use crate::atlas::ensure_glyphs_in_atlas;
use crate::component::{FontRequest, FontStatus, ShapingResult};
use crate::resource::FontCache;
use crate::shaping::shape_text;

/// Detects newly added FontRequest components and begins font loading.
///
/// If the font is already cached, marks the request as Ready immediately.
/// Otherwise, marks it as Loading (the actual fetch happens on the TypeScript side).
pub fn process_new_font_requests(
    mut font_requests: Query<(Entity, &mut FontRequest), Added<FontRequest>>,
    font_cache: Res<FontCache>,
) {
    for (_entity, mut request) in font_requests.iter_mut() {
        if request.status != FontStatus::Pending {
            continue;
        }

        if font_cache.is_loaded(&request.font_url) {
            request.status = FontStatus::Ready;
        } else {
            request.status = FontStatus::Loading;
            // TODO: trigger font fetch via event to TypeScript side
            bevy_log::info!("Font loading requested: {}", request.font_url);
        }
    }
}

/// Increments the frame counter each update cycle for LRU tracking.
pub fn tick_frame(mut font_cache: ResMut<FontCache>) {
    font_cache.current_frame += 1;
}

/// Shapes text and ensures all post-shaping glyphs are in the per-font atlas.
///
/// Pipeline: shape text -> collect glyph IDs -> rasterize missing glyphs -> attach result.
/// The atlas is keyed by glyph ID (not codepoint), so Arabic contextual forms,
/// ligatures, and other shaped variants are stored correctly.
pub fn generate_atlas_and_shape(
    mut commands: Commands,
    font_requests: Query<(Entity, &FontRequest), Changed<FontRequest>>,
    mut font_cache: ResMut<FontCache>,
) {
    let current_frame = font_cache.current_frame;

    // Collect entities to process (to avoid borrow conflict with font_cache)
    let to_process: Vec<(Entity, String, String)> = font_requests
        .iter()
        .filter(|(_, r)| r.status == FontStatus::Ready)
        .map(|(e, r)| (e, r.font_url.clone(), r.text.clone()))
        .collect();

    for (entity, font_url, text) in to_process {
        let Some(font_entry) = font_cache.get_mut(&font_url) else {
            bevy_log::warn!("Font marked Ready but not in cache: {}", font_url);
            continue;
        };

        // 1. Shape text with rustybuzz -> get glyph IDs + positions + units_per_em
        let Some((glyphs, _units_per_em)) = shape_text(&font_entry.data, &text) else {
            bevy_log::warn!("Text shaping failed for: {}", text);
            continue;
        };

        // 2. Collect glyph IDs from shaping output
        let glyph_ids: Vec<u16> = glyphs.iter().map(|g| g.glyph_id as u16).collect();

        // 3. Ensure all shaped glyphs are in the per-font atlas (on-demand rasterization)
        ensure_glyphs_in_atlas(
            &font_entry.sdf_font,
            &glyph_ids,
            &mut font_entry.atlas,
            current_frame,
        );

        // 4. Attach shaping result to entity
        commands.entity(entity).insert(ShapingResult { glyphs });
    }
}

/// Re-shapes text when FontRequest text or font changes on entities that already have results.
pub fn reshape_on_change(
    mut commands: Commands,
    changed_requests: Query<(Entity, &FontRequest), (Changed<FontRequest>, With<ShapingResult>)>,
    mut font_cache: ResMut<FontCache>,
) {
    let current_frame = font_cache.current_frame;

    let to_process: Vec<(Entity, String, String)> = changed_requests
        .iter()
        .filter(|(_, r)| r.status == FontStatus::Ready)
        .map(|(e, r)| (e, r.font_url.clone(), r.text.clone()))
        .collect();

    for (entity, font_url, text) in to_process {
        let Some(font_entry) = font_cache.get_mut(&font_url) else {
            continue;
        };

        let Some((glyphs, _units_per_em)) = shape_text(&font_entry.data, &text) else {
            continue;
        };

        let glyph_ids: Vec<u16> = glyphs.iter().map(|g| g.glyph_id as u16).collect();

        ensure_glyphs_in_atlas(
            &font_entry.sdf_font,
            &glyph_ids,
            &mut font_entry.atlas,
            current_frame,
        );

        commands.entity(entity).insert(ShapingResult { glyphs });
    }
}
