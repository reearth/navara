use bevy_ecs::{bundle::Bundle, component::Component};

use crate::Transform;

#[derive(Component)]
pub struct CameraMarker;

#[derive(Bundle)]
pub struct CameraBundle {
    pub marker: CameraMarker,
    pub transform: Transform,
}
