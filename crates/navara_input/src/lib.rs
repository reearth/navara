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
    /// Re-anchors the cursor position without emitting a `MouseMotion` delta.
    /// Sent on mousedown so a drag never computes its first delta against a
    /// position recorded before the window lost focus or visibility.
    MouseAnchor(MouseMoveInput),
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
        Input::MouseAnchor(ev) => {
            if let Some(mut pos) = world.get_resource_mut::<mouse::MouseCursorPosition>() {
                pos.x = ev.x;
                pos.y = ev.y;
            }
        }
        Input::MouseScroll(ev) => {
            world.write_message(ev.into_event(win));
        }
        Input::Touch(ev) => {
            world.write_message(ev);
        }
    }
}

#[cfg(test)]
mod tests {
    use bevy_ecs::{message::Messages, system::RunSystemOnce, world::World};
    use bevy_input::mouse::MouseMotion;

    use super::*;
    use crate::mouse::MouseCursorPosition;

    /// Runs the motion-conversion system once and returns the emitted motions,
    /// clearing both message buffers so the next run starts clean.
    fn run_motion_system(world: &mut World) -> Vec<MouseMotion> {
        let _ = world.run_system_once(mouse::trigger_mouse_motion_event);
        world.resource_mut::<Messages<MouseMoveInput>>().clear();
        world
            .resource_mut::<Messages<MouseMotion>>()
            .drain()
            .collect()
    }

    /// A mousedown anchor must reposition the tracked cursor without emitting a
    /// motion, so the first drag delta after refocusing the window stays small
    /// instead of spanning everything the OS cursor moved while the page was
    /// hidden or unfocused.
    #[test]
    fn mouse_anchor_repositions_cursor_without_motion() {
        let mut world = World::new();
        world.init_resource::<MouseCursorPosition>();
        world.init_resource::<Messages<MouseMoveInput>>();
        world.init_resource::<Messages<MouseMotion>>();
        let win = world.spawn_empty().id();

        // Cursor tracked at (0.1, 0.1) before the window loses focus.
        trigger_event(
            &mut world,
            win,
            Input::MouseMove(MouseMoveInput { x: 0.1, y: 0.1 }),
        );
        run_motion_system(&mut world);

        // The user comes back and presses the button at (0.9, 0.8): the anchor
        // updates the tracked position and emits no motion.
        trigger_event(
            &mut world,
            win,
            Input::MouseAnchor(MouseMoveInput { x: 0.9, y: 0.8 }),
        );
        assert!(run_motion_system(&mut world).is_empty());

        // The first move of the drag only produces the small in-drag delta.
        trigger_event(
            &mut world,
            win,
            Input::MouseMove(MouseMoveInput { x: 0.91, y: 0.8 }),
        );
        let motions = run_motion_system(&mut world);
        assert_eq!(motions.len(), 1);
        assert!((motions[0].delta.x - 0.01).abs() < 1e-6);
        assert_eq!(motions[0].delta.y, 0.0);
    }
}
