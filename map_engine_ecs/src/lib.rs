mod app;
mod buffer;
mod camera;
mod event;
mod input;
mod mesh;
mod object;
mod transform;

pub use buffer::*;
pub use event::{ComponentEvent, EntityEvent, Events};
pub use mesh::*;
pub use object::*;
pub use transform::*;

pub use input::*;

pub struct App {
    app: bevy_app::App,
    win: bevy_ecs::entity::Entity,
}

impl App {
    pub fn new() -> Self {
        let mut app = bevy_app::App::new();

        app.add_plugins(app::Plugin);

        let win = app.world.spawn_empty().id();

        Self { app, win }
    }

    pub fn update(&mut self) {
        self.app.update();
    }

    pub fn trigger_event(&mut self, ev: input::Input) {
        input::trigger_event(&mut self.app.world, self.win, ev);
    }

    pub fn read_events(&mut self) -> Option<Events> {
        let ev = self.app.world.get_resource::<event::EventStore>()?;
        Some(ev.events(&self.app.world))
    }

    pub fn get_buffer_u8(&self, handle: i32) -> Option<&[u8]> {
        let store = self.app.world.get_resource::<BufferStore>()?;
        store.get_u8(&handle)
    }

    pub fn get_buffer_u32(&self, handle: i32) -> Option<&[u32]> {
        let store = self.app.world.get_resource::<BufferStore>()?;
        store.get_u32(&handle)
    }

    pub fn get_buffer_f32(&self, handle: i32) -> Option<&[f32]> {
        let store = self.app.world.get_resource::<BufferStore>()?;
        store.get_f32(&handle)
    }

    pub fn set_buffer(&mut self, handle: i32, data: Vec<u8>) {
        let Some(mut store) = self.app.world.get_resource_mut::<BufferStore>() else {
            return;
        };
        store.set_u8(handle, data);
        self.app.world.send_event(buffer::BufferStoreEvent {
            handle,
            ty: buffer::BufferType::U8,
        });
    }
}

impl Default for App {
    fn default() -> Self {
        Self::new()
    }
}
