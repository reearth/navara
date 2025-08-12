use navara_camera::Orbit;
use navara_core::{vec3_to_xyz, Radians, LLE, WGS84_32};
use navara_math::{FloatType, Quat, Transform, Vec3};

pub fn update_camera_transform(r: FloatType) -> (Vec3, LLE<FloatType, Radians>) {
    let orbit = Orbit {
        horizon_quat: Quat::from_axis_angle(Vec3::X, 0.0),
        vertical_quat: Quat::from_axis_angle(Vec3::Y, 0.0),
        ..Default::default()
    };
    let mut camera_transform = Transform::from_translation(Vec3::ZERO);
    camera_transform.translation = orbit.vertical_quat * orbit.horizon_quat * Vec3::new(0.0, r, 0.0);
    camera_transform = camera_transform.looking_at(Vec3::ZERO, Vec3::Y);

    let camera_pos = camera_transform.transform_point(Vec3::ZERO);
    let camera_lle = WGS84_32.xyz_to_lle(vec3_to_xyz(camera_pos));

    (camera_pos, camera_lle)
}
