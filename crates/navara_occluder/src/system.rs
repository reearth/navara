use bevy_ecs::{
    query::{Added, Changed, Or},
    system::{Commands, Query},
};
use navara_core::WGS84_64;
use navara_math::{Transform, Vec3};

use navara_camera::CameraMarker;

use super::ellipsoidal_occluder::EllipsoidalOccluder;

pub fn startup(
    mut commands: Commands,
    camera_position: Query<(&Transform, &CameraMarker), Added<Transform>>,
) {
    for position in &camera_position {
        let camera_pos = position.0.transform_point(Vec3::ZERO);
        commands.spawn(EllipsoidalOccluder::new(&camera_pos, WGS84_64));
    }
}

#[allow(clippy::type_complexity)]
pub fn update(
    camera_position: Query<(&Transform, &CameraMarker), Or<(Added<Transform>, Changed<Transform>)>>,
    mut occluder: Query<&mut EllipsoidalOccluder>,
) {
    for position in &camera_position {
        let camera_position = position.0.transform_point(Vec3::ZERO);
        for mut occluder in &mut occluder {
            occluder.update(&camera_position, WGS84_64);
        }
    }
}
