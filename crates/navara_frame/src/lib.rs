#![doc = include_str!("../README.md")]

use bevy_app::{Plugin, PreUpdate};
use bevy_ecs::system::{ResMut, Resource};

pub struct FramePlugin;

impl Plugin for FramePlugin {
    fn build(&self, app: &mut bevy_app::App) {
        app.init_resource::<FrameManager>()
            .add_systems(PreUpdate, update_frame);
    }
}

#[derive(Resource, Default)]
pub struct FrameManager {
    rendered_frame: usize,
}

impl FrameManager {
    pub fn rendered_frame(&self) -> usize {
        self.rendered_frame
    }
}

fn update_frame(mut m: ResMut<FrameManager>) {
    m.rendered_frame += 1;
}
