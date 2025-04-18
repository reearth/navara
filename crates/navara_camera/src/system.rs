use bevy_ecs::{
    change_detection::DetectChanges,
    event::EventReader,
    query::{Added, Changed, Or, With},
    system::{Commands, Query, Res},
    world::Ref,
};
use bevy_input::{
    keyboard::KeyCode,
    mouse::{MouseButton, MouseMotion, MouseWheel},
    ButtonInput,
};
use navara_core::{
    ease_out_circ, east_north_up_to_fixed_frame, ray_ellipsoid, Angle, Ellipsoid, Ray, CRS,
    WGS84_32,
};
use navara_frame::FrameManager;
use navara_math::{EqualEpsilon, Mat3, Quat, Transform, Vec2, Vec3, EPSILON10, EPSILON3};
use navara_window::Window;

use crate::{
    helpers::get_pick_ray_from_camera, CameraChange, CameraController, CameraDirection,
    CameraInertia, CameraTranslate,
};

use super::{CameraFrustum, CameraMarker, Orbit};
use navara_input::MouseMoveInput;

pub fn startup(mut commands: Commands) {
    let orbit = Orbit::default();

    let transform = Transform::default();

    commands.spawn((
        CameraMarker,
        orbit.clone(),
        transform,
        CameraFrustum::new(
            &transform,
            1.,
            1e8,
            // This is for frustum culling, so need to organize
            Angle::new(50.).rad().val(),
            1.,
            1.1,
        ),
        CameraController::default(),
        CameraInertia::default(),
    ));
}

#[allow(clippy::type_complexity, clippy::too_many_arguments)]
pub fn update(
    window: Res<Window>,
    mut query: Query<
        (
            Ref<CameraMarker>,
            &mut Transform,
            &mut CameraController,
            &mut CameraInertia,
            &CameraFrustum,
            &mut Orbit,
        ),
        With<CameraMarker>,
    >,
    mb: Res<ButtonInput<MouseButton>>,
    mut mm: EventReader<MouseMotion>,
    mut mw: EventReader<MouseWheel>,
    mut _mp: EventReader<MouseMoveInput>,
    mut cc: EventReader<CameraChange>,
    mut ct: EventReader<CameraTranslate>,
    keys: Res<ButtonInput<KeyCode>>,
    frame: Res<FrameManager>,
) {
    let updated_at = frame.updated_at();
    let last_updated_at = frame.last_updated_at();
    let duration = (updated_at - last_updated_at) as f32;
    for (marker, mut transform, mut controller, mut inertia, frustum, mut orbit) in query.iter_mut()
    {
        if !controller.enabled {
            continue;
        }

        let cc = cc.read().last();
        if let Some(cc) = cc {
            apply_camera_change(&mut transform, &mut orbit, cc);
            continue;
        }

        // Handle camera translation
        handle_camera_translate(&mut transform, &mut orbit, &mut inertia, &mut ct);

        let is_ctrl = keys.pressed(KeyCode::ControlLeft) || keys.pressed(KeyCode::ControlRight);
        let _is_shift = keys.pressed(KeyCode::ShiftLeft) || keys.pressed(KeyCode::ShiftRight);

        // Handle rotations and movements
        handle_orbit_spin(
            &transform,
            &mut orbit,
            &mut controller,
            &mut inertia,
            &mb,
            &mut mm,
            is_ctrl,
        );
        handle_zoom(
            &transform,
            &mut orbit,
            &controller,
            &mut inertia,
            &mut mw,
            is_ctrl,
        );
        // handle_free_rotation(
        //     &mut transform,
        //     &controller,
        //     &mut inertia,
        //     &mb,
        //     &mut mp,
        //     &mut mm,
        //     is_shift,
        // );
        handle_tilt(
            &window,
            &mut orbit,
            &mut inertia,
            &mut controller,
            &mb,
            &mut mm,
            is_ctrl,
            &transform,
            frustum,
        );

        // Apply inertia
        apply_inertia(&mut orbit, &mut inertia, &controller);

        if needs_update(&inertia, &controller) || window.is_changed() || marker.is_added() {
            commit(&mut transform, &mut orbit);
        }

        if inertia.translate_time < controller.translate_duration {
            apply_camera_translate(&mut transform, &mut inertia, &controller)
        }

        after_inertia(&mut inertia, duration, &controller);
    }
}

fn commit(transform: &mut Transform, orbit: &mut Orbit) {
    let rotated_local_position = orbit.quat * orbit.local_position;
    let rotated_local_up = orbit.quat * orbit.local_up;
    let rotated_local_forward = if orbit.should_tilt {
        orbit.local_forward
    } else {
        orbit.quat * orbit.local_forward
    };

    let world_position = orbit.pivot + (orbit.world_quat * rotated_local_position);
    let world_up = orbit.world_quat * rotated_local_up;
    let world_forward = orbit.world_quat * rotated_local_forward;

    transform.translation = world_position;
    transform.look_to(world_forward, world_up);
}

fn handle_orbit_spin(
    transform: &Transform,
    orbit: &mut Orbit,
    controller: &mut CameraController,
    inertia: &mut CameraInertia,
    mb: &Res<ButtonInput<MouseButton>>,
    mm: &mut EventReader<MouseMotion>,
    is_ctrl: bool,
) {
    if !controller.enable_spin
        || !mb.pressed(MouseButton::Left)
        || is_ctrl
        || mb.pressed(MouseButton::Right)
    {
        return;
    }

    if mm.is_empty() {
        return;
    }

    controller.reset_mode();

    let world = orbit.get_default_world_quat();
    orbit.set_quat(transform, world, Vec3::ZERO, false, None);

    let distance_from_ellipsoid_surface = calc_distance_from_ellipsoid_surface(transform, WGS84_32);

    let ratio = distance_from_ellipsoid_surface.abs() / controller.minimum_zoom_distance;

    let Some(spin) = rotate(mm, controller, ratio * 1.5, ratio) else {
        return;
    };

    inertia.spin(spin);
}

// ref: https://github.com/CesiumGS/cesium/blob/0e9a425b475cd3cfdd90f35e9cdbdda453e448d8/packages/engine/Source/Scene/ScreenSpaceCameraController.js#L2462
#[allow(clippy::too_many_arguments)]
fn handle_tilt(
    window: &Window,
    orbit: &mut Orbit,
    inertia: &mut CameraInertia,
    controller: &mut CameraController,
    mb: &Res<ButtonInput<MouseButton>>,
    mm: &mut EventReader<MouseMotion>,
    is_ctrl: bool,
    transform: &Transform,
    frustum: &CameraFrustum,
) {
    let ellipsoid = WGS84_32;

    // TODO: Check whether picking point from terrain or center. If the camera is nearby ground, it should be picked by terrain.

    // TODO: Pick terrain height like here from depth buffer: https://github.com/CesiumGS/cesium/blob/0e9a425b475cd3cfdd90f35e9cdbdda453e448d8/packages/engine/Source/Scene/ScreenSpaceCameraController.js#L2557

    if !controller.enable_tilt
        || ((!is_ctrl || !mb.pressed(MouseButton::Left)) && !mb.pressed(MouseButton::Right))
    {
        return;
    }

    if mm.is_empty() {
        return;
    }

    controller.is_tilting = true;

    let center_2d = Vec2::new(window.raw_width() / 2., window.raw_height() / 2.);
    let ray = get_pick_ray_from_camera(window, transform, frustum, center_2d);
    // TODO: Support movement underground.
    let point = match ray_ellipsoid(&ray, ellipsoid) {
        i if i.start == f32::INFINITY => {
            // Calculate an edge of ellipsoid
            let ellipsoid_vec3 = Vec3::new(ellipsoid.a, ellipsoid.a, ellipsoid.b);
            let forward = ellipsoid_vec3 * ray.direction;
            let distance_to_edge = forward.dot(ray.origin);

            if distance_to_edge.equal_epsilon(EPSILON10) {
                1.
            } else {
                distance_to_edge
            }
        }
        i if i.start != 0. => i.start,
        i if i.end != 0. => i.end,
        // TODO: Handle the case where intersection point couldn't find.
        _ => 1.,
    };
    let center = ray.get_point(point);
    let enu_transform = east_north_up_to_fixed_frame(center, ellipsoid);

    if orbit.default_world_quat.is_none() {
        orbit.default_world_quat = Some(orbit.world_quat);
    }

    orbit.set_quat(
        transform,
        Quat::from_mat4(&enu_transform),
        center,
        true,
        Some(Vec3::Z),
    );

    let Some(mut spin) = rotate(mm, controller, 1., 1.) else {
        return;
    };

    if spin.x.abs() > spin.y.abs() {
        spin.y = 0.;
    } else {
        spin.x = 0.;
    }

    inertia.spin(spin);
}

fn rotate(
    mm: &mut EventReader<MouseMotion>,
    controller: &CameraController,
    ratio_x: f32,
    ratio_y: f32,
) -> Option<Vec3> {
    // Use just the latest motion
    let screen_delta = if let Some(ev) = mm.read().last() {
        Vec3::new(ev.delta.x, ev.delta.y, 0.0)
    } else {
        return None;
    };

    let pan_delta = Vec2::new(screen_delta.x * ratio_x, screen_delta.y * ratio_y);

    Some(Vec3::new(-pan_delta.x, -pan_delta.y, 0.0) * controller.spin_speed)
}

// Ref: https://github.com/NASA-AMMOS/3DTilesRendererJS/blob/2933415dd04f969c902a976df8c85f132409bae7/src/three/controls/GlobeControls.js#L408
fn handle_zoom(
    transform: &Transform,
    orbit: &mut Orbit,
    controller: &CameraController,
    inertia: &mut CameraInertia,
    mw: &mut EventReader<MouseWheel>,
    is_ctrl: bool,
) {
    if !controller.enable_zoom || mw.is_empty() || is_ctrl {
        return;
    }

    let zoom = if let Some(ev) = mw.read().last() {
        ev.y
    } else {
        return;
    };

    let world = orbit.get_default_world_quat();
    orbit.set_quat(transform, world, Vec3::ZERO, false, None);

    let distance_from_ellipsoid_surface = calc_distance_from_ellipsoid_surface(transform, WGS84_32);

    let dist = distance_from_ellipsoid_surface.max(0.);
    let d = zoom * controller.zoom_speed * dist * 0.0025;

    inertia.zoom(d);
}

fn calc_distance_from_ellipsoid_surface(transform: &Transform, ellipsoid: Ellipsoid<f32>) -> f32 {
    let camera_pos = transform.transform_point(Vec3::ZERO);
    let direction_to_center = -camera_pos.normalize();

    let ray = Ray {
        origin: camera_pos,
        direction: direction_to_center,
    };
    match ray_ellipsoid(&ray, ellipsoid) {
        i if i.start == f32::INFINITY => {
            // Calculate an edge of ellipsoid
            let ellipsoid_vec3 = Vec3::new(ellipsoid.a, ellipsoid.a, ellipsoid.b);
            let forward = ellipsoid_vec3 * ray.direction;
            let distance_to_edge = forward.dot(ray.origin);

            if distance_to_edge.equal_epsilon(EPSILON10) {
                1.
            } else {
                distance_to_edge
            }
        }
        i if i.start != 0. => i.start,
        i if i.end != 0. => i.end,
        // TODO: Handle the case where intersection point couldn't find.
        _ => 1.,
    }
}

fn apply_inertia(orbit: &mut Orbit, inertia: &mut CameraInertia, controller: &CameraController) {
    apply_spin(orbit, inertia, controller);
    apply_zoom(orbit, inertia, controller);
}

fn apply_spin(orbit: &mut Orbit, inertia: &mut CameraInertia, controller: &CameraController) {
    let t = inertia.spin_time / controller.spin_duration;
    if t > 1. {
        return;
    }
    let next = inertia.spin * (1. - ease_out_circ(t));
    let vertical = Quat::from_axis_angle(orbit.vertical_axis, next.y);
    let horizontal = Quat::from_axis_angle(orbit.horizontal_axis, next.x);
    orbit.quat *= horizontal * vertical;
}

fn apply_zoom(orbit: &mut Orbit, inertia: &mut CameraInertia, controller: &CameraController) {
    let t = inertia.zoom_time / controller.zoom_duration;
    if t > 1. {
        return;
    }
    let next_zoom = inertia.zoom * (1. - ease_out_circ(t));
    let next = orbit.local_position - orbit.local_forward * next_zoom;
    let length = next.length();
    if length >= controller.maximum_zoom_distance && next_zoom > 0. {
        return;
    }
    if length <= controller.minimum_zoom_distance && next_zoom < 0. {
        return;
    }
    orbit.local_position = next;
}

fn needs_update(inertia: &CameraInertia, controller: &CameraController) -> bool {
    inertia.spin_time < controller.spin_duration || inertia.zoom_time < controller.zoom_duration
}

fn after_inertia(inertia: &mut CameraInertia, duration: f32, controller: &CameraController) {
    if inertia.spin_time < controller.spin_duration {
        inertia.spin_time += duration;
    }
    if inertia.zoom_time < controller.zoom_duration {
        inertia.zoom_time += duration;
    }
    if inertia.translate_time < controller.translate_duration {
        inertia.translate_time += duration;
    }
}

/// Applies a camera change based on geographic position, heading, and pitch.
///
/// - `cc.position.xy`: longitude & latitude
/// - `cc.position.z`: camera height above the ground point (along normal)
/// - `cc.heading`: rotation around the local up axis (degrees)
/// - `cc.pitch`: tilt around the camera's right axis (degrees)
fn apply_camera_change(transform: &mut Transform, orbit: &mut Orbit, cc: &CameraChange) {
    *orbit = Orbit::default();

    let altitude = cc.position.z;
    let ground_point = Vec3::new(cc.position.x, cc.position.y, 0.0);

    // Convert geographic coordinates to world-space pivot (ground point)
    let pivot = CRS::Geographic.to_vec3(WGS84_32, ground_point, 0.0);
    let target_dir = pivot.normalize_or_zero();

    // Determine local right axis based on pivot normal
    let right = if target_dir.abs_diff_eq(Vec3::Z, EPSILON3)
        || target_dir.abs_diff_eq(-Vec3::Z, EPSILON3)
    {
        Vec3::X
    } else {
        target_dir.cross(Vec3::Z).normalize_or_zero()
    };

    // Local up axis
    let up = right.cross(target_dir).normalize_or_zero();
    let rot_mat = Mat3::from_cols(right, target_dir, up);

    let default_quat = Quat::from_mat3(&Mat3::from_cols(Vec3::NEG_X, Vec3::NEG_Y, Vec3::Z));
    let heading_quat = Quat::from_axis_angle(target_dir, -cc.heading.to_radians());

    // Set the orbit quaternion based on heading and rotation matrix
    let world_quat = heading_quat * Quat::from_mat3(&rot_mat) * default_quat;

    let cam_pos = -Vec3::Y * altitude.max(1.0); // Ensure a minimum altitude of 1.0

    let world_position = pivot + (world_quat * cam_pos);
    let mut world_up = world_quat * orbit.local_up;
    let mut world_forward = world_quat * orbit.local_forward;

    // Apply pitch (camera-local tilt around right axis)
    let camera_right = world_forward.cross(world_up).normalize_or_zero();
    let pitch_quat = Quat::from_axis_angle(camera_right, (cc.pitch + 90.0).to_radians());

    world_forward = pitch_quat * world_forward;
    world_up = pitch_quat * world_up;

    // Apply roll (rotation around forward vector)
    let roll_quat = Quat::from_axis_angle(world_forward, cc.roll.to_radians());
    world_up = roll_quat * world_up;

    transform.translation = world_position;
    transform.look_to(world_forward, world_up);

    orbit.set_quat(transform, world_quat, Vec3::ZERO, false, None);
}

fn handle_camera_translate(
    transform: &mut Transform,
    orbit: &mut Orbit,
    inertia: &mut CameraInertia,
    ct: &mut EventReader<CameraTranslate>,
) {
    let Some(ct) = ct.read().last() else {
        return;
    };

    // Get the camera's local forward, right, and up directions
    let forward = transform.forward();
    let right = transform.right();
    let up = transform.up();

    // Determine the movement direction vector based on the input direction
    let dir_vec = match ct.direction {
        CameraDirection::Forward => forward,
        CameraDirection::Backward => -forward,
        CameraDirection::Right => right,
        CameraDirection::Left => -right,
        CameraDirection::Up => up,
        CameraDirection::Down => -up,
    };

    // Move the camera by the specified amount in the chosen direction
    inertia.translate(dir_vec * ct.amount);

    // Reapply the orbit rotation to maintain a consistent view orientation
    let world = orbit.get_default_world_quat();
    orbit.set_quat(transform, world, Vec3::ZERO, false, None);
}

fn apply_camera_translate(
    transform: &mut Transform,
    inertia: &mut CameraInertia,
    controller: &CameraController,
) {
    let t = inertia.translate_time / controller.translate_duration;
    if t > 1. {
        return;
    }
    let next_trans = inertia.translate * (1. - ease_out_circ(t));
    let next = transform.translation + next_trans;
    let length = next.length();
    if length >= controller.maximum_zoom_distance {
        return;
    }
    if length <= controller.minimum_zoom_distance {
        return;
    }
    transform.translation = next;
}

// TODO
// // Transform systems
// pub fn update_camera_transform() {...}
// pub fn update_view_matrix() {...}

// // Constraint systems
// pub fn apply_height_limits() {...}
// pub fn handle_collisions() {...} ref: https://github.com/CesiumGS/cesium/blob/main/packages/engine/Source/Core/IntersectionTests.js

// // Mode-specific systems  ref: https://github.com/CesiumGS/cesium/blob/0e9a425b475cd3cfdd90f35e9cdbdda453e448d8/packages/engine/Source/Scene/SceneMode.js#L7
// pub fn update_3d() {...}
// pub fn update_2d() {...}

// // Flight/animation systems
// pub fn update_camera_flight() {...}

#[allow(clippy::type_complexity)]
pub fn update_frustum(
    mut query: Query<(&mut CameraFrustum, &Transform), Or<(Added<Transform>, Changed<Transform>)>>,
) {
    for (mut frustum, transform) in query.iter_mut() {
        frustum.update_sse_denominator();
        frustum.update_planes(transform);
    }
}
