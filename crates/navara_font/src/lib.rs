#![doc = include_str!("../README.md")]

pub mod atlas;
pub mod component;
pub mod resource;
pub mod shaping;
mod system;

pub use component::{FontRequest, FontStatus, ShapedGlyph, ShapingResult};
pub use resource::{FontCache, FontEntry, GlyphMetrics, SdfAtlas};

use bevy_app::{App, Plugin, PostUpdate, PreUpdate};
use bevy_ecs::schedule::IntoScheduleConfigs;

pub struct FontPlugin;

impl Plugin for FontPlugin {
    fn build(&self, app: &mut App) {
        app.init_resource::<FontCache>()
            .add_systems(
                PreUpdate,
                (
                    system::tick_frame,
                    system::process_new_font_requests,
                )
                    .chain(),
            )
            .add_systems(
                PostUpdate,
                (
                    system::generate_atlas_and_shape,
                    system::reshape_on_change,
                )
                    .chain(),
            );
    }
}
