#![doc = include_str!("../README.md")]

use bevy_app::{Plugin, PreUpdate};
use bevy_ecs::{prelude::Resource, system::ResMut};

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
    updated_at: f64,
    last_updated_at: f64,
}

impl FrameManager {
    pub fn rendered_frame(&self) -> usize {
        self.rendered_frame
    }

    pub fn updated_at(&self) -> f64 {
        self.updated_at
    }

    pub fn last_updated_at(&self) -> f64 {
        self.last_updated_at
    }

    pub fn set_updated_at(&mut self, at: f64) {
        self.last_updated_at = self.updated_at;
        self.updated_at = at;
    }
}

fn update_frame(mut m: ResMut<FrameManager>) {
    m.rendered_frame += 1;
}
