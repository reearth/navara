use bevy_ecs::event::Event;
use navara_math::{FloatType, Vec3};

#[derive(Debug, Clone, Copy, PartialEq, Event)]
pub struct CameraChange {
    pub position: Vec3,     // [longitude, latitude, altitude]
    pub pitch: FloatType,   // pitch in degrees, -180 to 0
    pub heading: FloatType, // heading in degrees, -180 to 180
    pub roll: FloatType,    // roll in degrees, -180 to 180
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum CameraDirection {
    Forward,
    Backward,
    Left,
    Right,
    Up,
    Down,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum CamDirType {
    Standard(CameraDirection), // Uses predefined directions (e.g., Forward, Left)
    Custom(Vec3),              // Uses a custom Vec3 direction
}

#[derive(Debug, Clone, Copy, PartialEq, Event)]
pub struct CameraTranslate {
    pub amount: FloatType,     // amount to move in meters
    pub direction: CamDirType, // direction to move in
}
