mod store;

use bevy_ecs::event::Event;
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
