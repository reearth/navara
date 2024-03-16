mod store;

use bevy_ecs::{component::Component, event::Event};
use map_engine_core::{Extent, Radians};
pub use store::*;

pub struct BufferStorePlugin;

impl bevy_app::Plugin for BufferStorePlugin {
    fn build(&self, app: &mut bevy_app::App) {
        app.init_resource::<BufferStore>();
        app.add_event::<BufferStoreEvent>();
        app.add_event::<BufferStoreCompletedEvent>();
    }
}

#[derive(Debug, Event)]
pub struct BufferStoreEvent {
    pub handle: Handle,
    pub ty: BufferType,
}

#[derive(Debug, Event)]
pub struct BufferStoreCompletedEvent {
    pub handle: Handle,
    pub ty: BufferType,
}

#[derive(Debug, Clone, PartialEq, Default, Component)]
pub struct DataRequester {
    pub handle: Handle,
    pub url: String,
    pub loaded: bool,
    pub extent: Option<Extent<f32, Radians>>,
}

impl DataRequester {
    pub fn new(handle: Handle, url: String, extent: Option<Extent<f32, Radians>>) -> Self {
        Self {
            handle,
            url,
            loaded: false,
            extent,
        }
    }

    pub fn from_store(url: String, buf: &mut BufferStore, extent: Option<Extent<f32, Radians>>) -> Self {
        Self::new(buf.new_handle(), url, extent)
    }
}
