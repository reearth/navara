#![doc = include_str!("../README.md")]

mod store;

use bevy_ecs::{entity::Entity, message::Message};
pub use store::*;

pub struct BufferStorePlugin;

impl bevy_app::Plugin for BufferStorePlugin {
    fn build(&self, app: &mut bevy_app::App) {
        app.init_resource::<BufferStore>();
        app.add_message::<BufferStoreLoadedEvent>();
        app.add_message::<BufferStoreFailedEvent>();
    }
}

#[derive(Debug, Message)]
pub struct BufferStoreLoadedEvent {
    pub id: Entity,
    pub ty: BufferType,
    pub handle: Handle,
}

#[derive(Debug, Message)]
pub struct BufferStoreFailedEvent {
    pub id: Entity,
}
