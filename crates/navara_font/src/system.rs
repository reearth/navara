use bevy_ecs::system::{ResMut};
use crate::resource::FontCache;

/// Increments the frame counter each update cycle for LRU tracking.
pub fn tick_frame(mut font_cache: ResMut<FontCache>) {
    font_cache.current_frame += 1;
}
