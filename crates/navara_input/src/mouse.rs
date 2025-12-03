use bevy_ecs::{
    entity::Entity,
    event::{Event, EventReader, EventWriter},
    prelude::Resource,
    system::ResMut,
};

use bevy_input::{mouse::MouseMotion, ButtonState};
use bevy_log::info;
use navara_math::RawVec2;

pub type MouseButton = bevy_input::mouse::MouseButton;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct MouseButtonInput {
    pub button: MouseButton,
    pub state: ButtonState,
}

impl MouseButtonInput {
    pub fn into_event(self, win: Entity) -> bevy_input::mouse::MouseButtonInput {
        bevy_input::mouse::MouseButtonInput {
            button: self.button,
            state: self.state,
            window: win,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MouseScrollUnit {
    Line,
    Pixel,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct MouseScrollInput {
    pub unit: MouseScrollUnit,
    pub x: f32,
    pub y: f32,
}

impl MouseScrollInput {
    pub fn into_event(self, win: Entity) -> bevy_input::mouse::MouseWheel {
        bevy_input::mouse::MouseWheel {
            unit: match self.unit {
                MouseScrollUnit::Line => bevy_input::mouse::MouseScrollUnit::Line,
                MouseScrollUnit::Pixel => bevy_input::mouse::MouseScrollUnit::Pixel,
            },
            x: self.x,
            y: self.y,
            window: win,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Event)]
pub struct MouseMoveInput {
    /// Relative position from window.
    /// 0.0 - 1.0
    pub x: f32,
    /// Relative position from window.
    /// 0.0 - 1.0
    pub y: f32,
}

#[derive(Debug, Clone, Copy, PartialEq, Default, Resource)]
pub struct MouseCursorPosition {
    pub x: f32,
    pub y: f32,
}

pub fn trigger_mouse_motion_event(
    mut res: ResMut<MouseCursorPosition>,
    mut pos: EventReader<MouseMoveInput>,
    mut motion: EventWriter<MouseMotion>,
) {
    for event in pos.read() {
        let delta_x = event.x - res.x;
        let delta_y = event.y - res.y;
        // info!("Mouse moved from ({}, {})", res.x, res.y);
        res.x = event.x;
        res.y = event.y;
        info!("Mouse moved to ({}, {})", res.x, res.y);
        // info!("Mouse moved by ({}, {})", delta_x, delta_y);
        if delta_x != 0.0 || delta_y != 0.0 {
            motion.write(MouseMotion {
                delta: RawVec2::new(delta_x, delta_y),
            });
        }
    }
}
