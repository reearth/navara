use bevy_ecs::{
    query::{Added, Changed},
    system::{Commands, Query},
};
use bevy_math::Vec3;
use bevy_transform::components::Transform;
use navara_core::WGS84_32;

use crate::camera::CameraMarker;

use super::ellipsoidal_occluder::EllipsoidalOccluder;

pub fn startup(
    mut commands: Commands,
    camera_position: Query<(&Transform, &CameraMarker), Added<Transform>>,
) {
    for position in &camera_position {
        commands.spawn(EllipsoidalOccluder::new(
            &position.0.transform_point(Vec3::ZERO),
            WGS84_32,
        ));
    }
}

pub fn update(
    camera_position: Query<(&mut Transform, &CameraMarker), Changed<Transform>>,
    mut occluder: Query<&mut EllipsoidalOccluder>,
) {
    for position in &camera_position {
        let camera_position = position.0.transform_point(Vec3::ZERO);
        for mut occluder in &mut occluder {
            occluder.update(&camera_position, WGS84_32);
        }
    }
}
