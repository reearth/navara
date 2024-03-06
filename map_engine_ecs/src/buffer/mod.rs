mod store;

use bevy_ecs::{component::Component, event::Event};
pub use store::*;

pub struct BufferStorePlugin;

impl bevy_app::Plugin for BufferStorePlugin {
    fn build(&self, app: &mut bevy_app::App) {
        app.init_resource::<BufferStore>();
        app.add_event::<BufferStoreEvent>();
    }
}

#[derive(Debug, Event)]
pub struct BufferStoreEvent {
    pub handle: Handle,
    pub ty: BufferType,
}

#[derive(Debug, Clone, PartialEq, Default, Component)]
pub struct DataRequester {
    pub handle: Handle,
    pub url: String,
    pub loaded: bool,
}

impl DataRequester {
    pub fn new(handle: Handle, url: String) -> Self {
        Self {
            handle,
            url,
            loaded: false,
        }
    }

    pub fn from_store(url: String, buf: &mut BufferStore) -> Self {
        Self::new(buf.new_handle(), url)
    }
}
