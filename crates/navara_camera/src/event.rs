use bevy_ecs::event::Event;
use navara_math::{FloatType, Vec3};

#[derive(Debug, Clone, Copy, PartialEq, Event)]
pub struct CameraChange {
    pub position: Option<Vec3>,     // [longitude, latitude, altitude]
    pub pitch: Option<FloatType>,   // pitch in degrees, -180 to 0
    pub heading: Option<FloatType>, // heading in degrees, -180 to 180
    pub roll: Option<FloatType>,    // roll in degrees, -180 to 180
}
