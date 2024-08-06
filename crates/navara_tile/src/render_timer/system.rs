use bevy_ecs::system::{Res, ResMut};
use bevy_time::Time;

use super::res::RenderTimer;

pub fn run_if(render_timer: Res<RenderTimer>) -> bool {
    render_timer.timer.finished()
}

pub fn tick(time: Res<Time>, mut render_timer: ResMut<RenderTimer>) {
    render_timer.timer.tick(time.delta());
}

pub fn reset_timer(mut render_timer: ResMut<RenderTimer>) {
    render_timer.timer.reset();
}
