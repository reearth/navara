use bevy_app::{App, Plugin, PreUpdate};
use bevy_ecs::{entity::Entity, world::World};

mod keyboard;
mod mouse;

pub use keyboard::{ButtonState, KeyCode, KeyboardInput};
pub use mouse::{MouseButton, MouseButtonInput, MouseMoveInput, MouseScrollInput, MouseScrollUnit};

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum Input {
    Keyboard(KeyboardInput),
    MouseButton(MouseButtonInput),
    MouseMove(MouseMoveInput),
    MouseScroll(MouseScrollInput),
}

pub struct InputPlugin;

impl Plugin for InputPlugin {
    fn build(&self, app: &mut App) {
        app.add_plugins(bevy_input::InputPlugin)
            .init_resource::<mouse::MouseCursorPosition>()
            .add_event::<MouseMoveInput>()
            .add_systems(PreUpdate, mouse::trigger_mouse_motion_event);
    }
}

pub fn trigger_event(world: &mut World, win: Entity, ev: Input) {
    match ev {
        Input::Keyboard(ev) => world.send_event(ev.into_event(win)),
        Input::MouseButton(ev) => world.send_event(ev.into_event(win)),
        Input::MouseMove(ev) => world.send_event(ev),
        Input::MouseScroll(ev) => world.send_event(ev.into_event(win)),
    }
}
