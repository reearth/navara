#![doc = include_str!("../README.md")]

pub mod atlas;
pub mod resource;
pub mod shaping;

#[cfg(feature = "bevy")]
mod system;

pub use resource::{FontCache, FontEntry, GlyphMetrics, SDFAtlas};

#[cfg(feature = "bevy")]
use bevy_app::{App, Plugin, PreUpdate};

#[cfg(feature = "bevy")]
pub struct FontPlugin;

#[cfg(feature = "bevy")]
impl Plugin for FontPlugin {
    fn build(&self, app: &mut App) {
        app.init_resource::<FontCache>()
            .add_systems(PreUpdate, system::tick_frame);
    }
}
