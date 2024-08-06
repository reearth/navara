use bevy_ecs::system::Resource;
use bevy_time::{Timer, TimerMode};

/// This is used to set the timer for rendering tile to avoid blocking the frame.
#[derive(Default, Resource)]
pub struct RenderTimer {
    pub(super) timer: Timer,
}

impl RenderTimer {
    pub fn new() -> Self {
        Self {
            timer: Timer::from_seconds(0.01, TimerMode::Repeating),
        }
    }
}
