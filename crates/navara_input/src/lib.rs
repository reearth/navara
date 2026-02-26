#![doc = include_str!("../README.md")]

use bevy_app::{App, Plugin, PreUpdate};
use bevy_ecs::{entity::Entity, world::World};

mod keyboard;
mod mouse;
mod touch;

pub use keyboard::{ButtonState, Key, KeyCode, KeyboardInput};
pub use mouse::{MouseButton, MouseButtonInput, MouseMoveInput, MouseScrollInput, MouseScrollUnit};
pub use touch::{TouchControl, TouchGesture, TouchInput, TouchList, TouchState};

#[derive(Debug, Clone, PartialEq)]
pub enum Input {
    Keyboard(KeyboardInput),
    MouseButton(MouseButtonInput),
    MouseMove(MouseMoveInput),
    MouseScroll(MouseScrollInput),
    Touch(TouchInput),
}

pub struct InputPlugin;

impl Plugin for InputPlugin {
    fn build(&self, app: &mut App) {
        app.add_plugins(bevy_input::InputPlugin)
            .init_resource::<mouse::MouseCursorPosition>()
            .init_resource::<TouchList>()
            .add_message::<MouseMoveInput>()
            .add_message::<TouchInput>()
            .add_message::<touch::TouchControl>()
            .add_systems(PreUpdate, mouse::trigger_mouse_motion_event)
            .add_systems(PreUpdate, touch::process_touch_input_events);
    }
}

pub fn trigger_event(world: &mut World, win: Entity, ev: Input) {
    match ev {
        Input::Keyboard(ev) => {
            world.write_message(ev.into_event(win));
        }
        Input::MouseButton(ev) => {
            world.write_message(ev.into_event(win));
        }
        Input::MouseMove(ev) => {
            world.write_message(ev);
        }
        Input::MouseScroll(ev) => {
            world.write_message(ev.into_event(win));
        }
        Input::Touch(ev) => {
            world.write_message(ev);
        }
    }
}
