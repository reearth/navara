use bevy_ecs::event::Event;
use navara_math::{FloatType, Vec3};

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct CameraOrientation {
    pub pitch: Option<FloatType>,   // pitch in degrees, -180 to 0
    pub heading: Option<FloatType>, // heading in degrees, -180 to 180
    pub roll: Option<FloatType>,    // roll in degrees, -180 to 180
}

impl Default for CameraOrientation {
    fn default() -> Self {
        Self {
            pitch: Some(-90.0),
            heading: Some(0.0),
            roll: Some(0.0),
        }
    }
}

impl CameraOrientation {
    pub fn get_heading(&self) -> FloatType {
        self.heading
            .unwrap_or(CameraOrientation::default().heading.unwrap())
    }

    pub fn get_pitch(&self) -> FloatType {
        self.pitch
            .unwrap_or(CameraOrientation::default().pitch.unwrap())
    }

    pub fn get_roll(&self) -> FloatType {
        self.roll
            .unwrap_or(CameraOrientation::default().roll.unwrap())
    }
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
pub enum CameraEvent {
    Change {
        position: Option<Vec3>,                 // [longitude, latitude, altitude]
        orientation: Option<CameraOrientation>, // [pitch, heading, roll]
    },
    Translate {
        amount: FloatType,     // amount to move in meters
        direction: CamDirType, // direction to move in
    },
    FlyTo {
        position: Option<Vec3>,                 // [longitude, latitude, altitude]
        orientation: Option<CameraOrientation>, // [pitch, heading, roll]
        duration: Option<FloatType>,            // duration in milliseconds(ms)
        max_height: Option<FloatType>,          // The maximum height at the peak of the flight.
    },
    LookAt {
        target: Vec3, // [longitude, latitude, altitude]
        offset: Vec3, // The offset from the target in the local east-north-up reference frame centered at the target.
    },
    RotateAroundAxis {
        axis: Option<Vec3>, // The axis of rotation in the world coordinate system.
        angle: FloatType,   // The angle to rotate around the axis in radians.
    },
    Follow {
        enabled: bool,
        target: Option<Vec3>, // [longitude, latitude, altitude]
        offset: Option<Vec3>, // The offset from the target in the local east-north-up reference frame centered at the target.
    },
}

#[derive(Event)]
pub struct FrustumEvent {
    pub fov: Option<FloatType>,  // field of view in degrees
    pub near: Option<FloatType>, // near clipping plane distance
    pub far: Option<FloatType>,  // far clipping plane distance
}
