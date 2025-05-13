use navara_core::{east_north_up_to_fixed_frame, Ray, WGS84_32};
use navara_math::{
    zero_to_two_pi, EqualEpsilon, Quat, Transform, Vec2, Vec3, EPSILON3, PI_OVER_TWO, TWO_PI,
};
use navara_window::Window;

use crate::CameraFrustum;

// Ref: https://github.com/CesiumGS/cesium/blob/0e9a425b475cd3cfdd90f35e9cdbdda453e448d8/packages/engine/Source/Scene/Camera.js#L3035
pub fn get_pick_ray_from_camera(
    window: &Window,
    camera_transform: &Transform,
    frustum: &CameraFrustum,
    position_2d: Vec2,
) -> Ray {
    get_pick_ray_perspective(window, camera_transform, frustum, position_2d)
}

// Ref: https://github.com/CesiumGS/cesium/blob/0e9a425b475cd3cfdd90f35e9cdbdda453e448d8/packages/engine/Source/Scene/Camera.js#L2946
// NOTE: We need to calculate it in f64 due to precision.
fn get_pick_ray_perspective(
    window: &Window,
    camera_transform: &Transform,
    frustum: &CameraFrustum,
    position_2d: Vec2,
) -> Ray {
    // TODO: Cache these calculation in struct
    let width = window.raw_width() as f64;
    let height = window.raw_height() as f64;
    let position = camera_transform.transform_point(Vec3::ZERO).as_dvec3();
    let forward = camera_transform.forward().as_dvec3();
    let right = camera_transform.right().as_dvec3();
    let up = camera_transform.up().as_dvec3();
    //

    let position_2d = position_2d.as_dvec2();

    let tan_phi = (frustum.fov_y as f64 * 0.5).tan();
    let tan_theta = frustum.aspect_ratio as f64 * tan_phi;
    let near = frustum.near as f64;

    let x = (2.0 / width) * position_2d.x - 1.0;
    let y = (2.0 / height) * (height - position_2d.y) - 1.0;

    let near_center = position + (forward * near);

    let x_dir = right * (x * near * tan_theta);
    let y_dir = up * (y * near * tan_phi);

    Ray {
        origin: position.as_vec3(),
        direction: (near_center + x_dir + y_dir - position)
            .as_vec3()
            .normalize_or_zero(),
    }
}

// ref: https://github.com/CesiumGS/cesium/blob/fb314464d211abf51649b17151137db7a403502a/packages/engine/Source/Scene/Camera.js#L830
pub fn get_pitch(transform: &Transform) -> f32 {
    let ellipsoid = WGS84_32;
    let camera_pos = transform.transform_point(Vec3::ZERO);

    let enu_transform = east_north_up_to_fixed_frame(camera_pos, ellipsoid);
    let enu_quat = Quat::from_mat4(&enu_transform);
    let inverse = enu_quat.inverse();
    let local_forward = (inverse * transform.forward().as_vec3()).normalize_or_zero();

    (PI_OVER_TWO - local_forward.z.acos()).to_degrees()
}

// ref: https://github.com/CesiumGS/cesium/blob/fb314464d211abf51649b17151137db7a403502a/packages/engine/Source/Scene/Camera.js#L817C21-L817C30
pub fn get_heading(transform: &Transform) -> f32 {
    let ellipsoid = WGS84_32;
    let camera_pos = transform.transform_point(Vec3::ZERO);

    let enu_transform = east_north_up_to_fixed_frame(camera_pos, ellipsoid);
    let enu_quat = Quat::from_mat4(&enu_transform);
    let inverse = enu_quat.inverse();
    let local_up = (inverse * transform.up().as_vec3()).normalize_or_zero();
    let local_forward = (inverse * transform.forward().as_vec3()).normalize_or_zero();

    let heading = if local_forward.z.abs().equal_diff_epsilon(1.0, EPSILON3) {
        local_up.y.atan2(local_up.x) - PI_OVER_TWO
    } else {
        local_forward.y.atan2(local_forward.x) - PI_OVER_TWO
    };

    (TWO_PI - zero_to_two_pi(heading)).to_degrees()
}

// ref: https://github.com/CesiumGS/cesium/blob/fb314464d211abf51649b17151137db7a403502a/packages/engine/Source/Scene/Camera.js#L834
pub fn get_roll(transform: &Transform) -> f32 {
    let ellipsoid = WGS84_32;
    let camera_pos = transform.transform_point(Vec3::ZERO);

    let enu_transform = east_north_up_to_fixed_frame(camera_pos, ellipsoid);
    let enu_quat = Quat::from_mat4(&enu_transform);
    let inverse = enu_quat.inverse();
    let local_up = (inverse * transform.up().as_vec3()).normalize_or_zero();
    let local_forward = (inverse * transform.forward().as_vec3()).normalize_or_zero();
    let local_right = (inverse * transform.right().as_vec3()).normalize_or_zero();

    // Checks if the forward vector is nearly vertical (Z ≈ ±1).
    if local_forward.z.abs().equal_diff_epsilon(1.0, EPSILON3) {
        0.0
    } else {
        zero_to_two_pi((-local_right.z).atan2(local_up.z) + TWO_PI).to_degrees()
    }
}

#[cfg(test)]
mod test {
    use approx::assert_abs_diff_eq;
    use navara_core::Angle;
    use navara_math::{AbsDiffEqVec3, Transform, Vec2, Vec3};
    use navara_window::Window;

    use crate::CameraFrustum;

    use super::get_pick_ray_from_camera;

    #[test]
    fn it_should_pick_ray_perspective() {
        let window = Window {
            width: 100.,
            height: 100.,
            pixel_ratio: 1.,
        };
        let camera = Transform::from_translation(Vec3::Z);

        assert_eq!(camera.up().as_vec3(), Vec3::Y);
        assert_eq!(camera.right().as_vec3(), Vec3::X);

        let frustum = CameraFrustum::new(
            &camera,
            0.1,
            1000.,
            Angle::new(50.).rad().val(),
            window.width / window.height,
            1.,
        );

        let position_2d = Vec2::new(window.raw_width() / 2., window.raw_height() / 2.);
        let ray = get_pick_ray_from_camera(&window, &camera, &frustum, position_2d);
        assert_eq!(ray.direction, Vec3::NEG_Z,);

        let position_2d = Vec2::new(window.raw_width() / 2., window.raw_height());
        let ray = get_pick_ray_from_camera(&window, &camera, &frustum, position_2d);
        assert_abs_diff_eq!(
            AbsDiffEqVec3(ray.direction),
            AbsDiffEqVec3(Vec3::new(0., -0.42, -0.9)),
            epsilon = Vec3::new(0.01, 0.01, 0.01)
        );
    }
}
