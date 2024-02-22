mod app;
mod camera;
mod event;
mod input;
mod object;
mod transform;

pub use event::{ComponentEvent, EntityEvent, Events};
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
}

impl Default for App {
    fn default() -> Self {
        Self::new()
    }
}
