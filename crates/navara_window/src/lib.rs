#![doc = include_str!("../README.md")]

use bevy_app::Update;
use bevy_ecs::{
    event::{Event, EventReader},
    system::{Query, Resource},
};

use navara_camera::{CameraFrustum, CameraMarker};
use navara_math::FloatType;

pub struct WindowPlugin;

impl bevy_app::Plugin for WindowPlugin {
    fn build(&self, app: &mut bevy_app::App) {
        app.init_resource::<Window>();
        app.add_event::<WindowResizeEvent>();
        app.add_systems(Update, handle_resize);
    }
}

fn handle_resize(
    mut camera: Query<(&CameraMarker, &mut CameraFrustum)>,
    mut ev: EventReader<WindowResizeEvent>,
) {
    for w in ev.read() {
        for (_, mut frustum) in &mut camera {
            frustum.aspect_ratio = w.width / w.height;
            frustum.update_sse_denominator();
        }
    }
}

#[derive(Debug, Event)]
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
