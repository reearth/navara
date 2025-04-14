use bevy_ecs::event::Event;
use navara_math::{FloatType, Vec3};

#[derive(Debug, Clone, Copy, PartialEq, Event)]
pub struct CameraChange {
    pub position: Vec3,     // [longitude, latitude, altitude]
    pub pitch: FloatType,   // pitch in degrees, -180 to 180
    pub heading: FloatType, // heading in degrees, -180 to 180
}
