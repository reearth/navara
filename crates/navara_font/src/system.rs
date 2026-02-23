use bevy_ecs::entity::Entity;
use bevy_ecs::query::{Added, Changed, With};
use bevy_ecs::system::{Commands, Query, ResMut};

use crate::atlas::populate_atlas_for_text;
use crate::component::{FontRequest, FontStatus, ShapingResult};
use crate::resource::{FontCache, SdfAtlas};
use crate::shaping::shape_text;

/// Detects newly added FontRequest components and begins font loading.
///
/// If the font is already cached, marks the request as Ready immediately.
/// Otherwise, marks it as Loading (the actual fetch will happen on the TypeScript side,
/// which will provide the font data back via a buffer store).
pub fn process_new_font_requests(
    mut font_requests: Query<(Entity, &mut FontRequest), Added<FontRequest>>,
    font_cache: ResMut<FontCache>,
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

/// Generates the SDF atlas when a font becomes available and shapes any pending text.
///
/// Runs when a FontRequest transitions to Ready status, indicating the font data
/// is available in the cache. Generates atlas entries for the requested text
/// and produces shaping results.
pub fn generate_atlas_and_shape(
    mut commands: Commands,
    font_requests: Query<(Entity, &FontRequest), Changed<FontRequest>>,
    font_cache: ResMut<FontCache>,
    mut atlas: ResMut<SdfAtlas>,
) {
    for (entity, request) in font_requests.iter() {
        if request.status != FontStatus::Ready {
            continue;
        }

        let Some(font) = font_cache.get(&request.font_url) else {
            bevy_log::warn!("Font marked Ready but not in cache: {}", request.font_url);
            continue;
        };

        // Generate SDF atlas entries for glyphs in this text
        populate_atlas_for_text(&font.sdf_font, &request.text, &mut atlas);

        // Shape the text using harfbuzz
        if let Some(glyphs) = shape_text(&font.data, &request.text) {
            commands.entity(entity).insert(ShapingResult { glyphs });
        } else {
            bevy_log::warn!("Text shaping failed for: {}", request.text);
        }
    }
}

/// Re-shapes text when the FontRequest text or font changes.
pub fn reshape_on_change(
    mut commands: Commands,
    changed_requests: Query<
        (Entity, &FontRequest),
        (Changed<FontRequest>, With<ShapingResult>),
    >,
    font_cache: ResMut<FontCache>,
    mut atlas: ResMut<SdfAtlas>,
) {
    for (entity, request) in changed_requests.iter() {
        if request.status != FontStatus::Ready {
            continue;
        }

        let Some(font) = font_cache.get(&request.font_url) else {
            continue;
        };

        // Ensure new glyphs are in the atlas
        populate_atlas_for_text(&font.sdf_font, &request.text, &mut atlas);

        // Re-shape
        if let Some(glyphs) = shape_text(&font.data, &request.text) {
            commands.entity(entity).insert(ShapingResult { glyphs });
        }
    }
}
