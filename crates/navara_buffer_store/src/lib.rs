#![doc = include_str!("../README.md")]

mod store;

use bevy_ecs::{entity::Entity, event::Event};
pub use store::*;

pub struct BufferStorePlugin;

impl bevy_app::Plugin for BufferStorePlugin {
    fn build(&self, app: &mut bevy_app::App) {
        app.init_resource::<BufferStore>();
        app.add_event::<BufferStoreLoadedEvent>();
        app.add_event::<BufferStoreFailedEvent>();
    }
}

#[derive(Debug, Event)]
pub struct BufferStoreLoadedEvent {
    pub id: Entity,
    pub ty: BufferType,
}

#[derive(Debug, Event)]
pub struct BufferStoreFailedEvent {
    pub id: Entity,
}
