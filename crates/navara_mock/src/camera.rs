use navara_camera::Orbit;
use navara_core::{vec3_to_xyz, Radians, LLE, WGS84_64};
use navara_math::{Quat, Transform, Vec3};

pub fn update_camera_transform(r: f64) -> (Vec3, LLE<f64, Radians>) {
    let orbit = Orbit {
        horizon_quat: Quat::from_axis_angle(Vec3::X, 0.0),
        vertical_quat: Quat::from_axis_angle(Vec3::Y, 0.0),
        ..Default::default()
    };
    let mut camera_transform = Transform::from_translation(Vec3::ZERO);
    camera_transform.translation =
        orbit.vertical_quat * orbit.horizon_quat * Vec3::new(0.0, r, 0.0);
    camera_transform = camera_transform.looking_at(Vec3::ZERO, Vec3::Y);

    let camera_pos = camera_transform.transform_point(Vec3::ZERO);
    let camera_lle = WGS84_64.xyz_to_lle(vec3_to_xyz(camera_pos));

    (camera_pos, camera_lle)
}
