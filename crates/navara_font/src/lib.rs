#![doc = include_str!("../README.md")]

pub mod atlas;
pub mod resource;
pub mod shaping;
mod system;

pub use resource::{FontCache, FontEntry, GlyphMetrics, SDFAtlas};

use bevy_app::{App, Plugin, PreUpdate};

pub struct FontPlugin;

impl Plugin for FontPlugin {
    fn build(&self, app: &mut App) {
        app.init_resource::<FontCache>()
            .add_systems(PreUpdate, system::tick_frame);
    }
}
