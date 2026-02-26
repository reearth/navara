#![doc = include_str!("../README.md")]

use bevy_ecs::{message::Message, prelude::Resource};

use navara_math::FloatType;

pub struct WindowPlugin;

impl bevy_app::Plugin for WindowPlugin {
    fn build(&self, app: &mut bevy_app::App) {
        app.init_resource::<Window>();
        app.add_message::<WindowResizeEvent>();
    }
}

#[derive(Debug, Message)]
pub struct WindowResizeEvent {
    pub width: FloatType,
    pub height: FloatType,
    #[allow(unused)]
    pub pixel_ratio: FloatType,
}

#[derive(Default, Resource)]
pub struct Window {
    pub width: FloatType,
    pub height: FloatType,
    pub pixel_ratio: FloatType,
}

impl Window {
    pub fn raw_width(&self) -> FloatType {
        self.width / self.pixel_ratio
    }

    pub fn raw_height(&self) -> FloatType {
        self.height / self.pixel_ratio
    }
}
