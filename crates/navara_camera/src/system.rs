use std::f32::consts::PI;

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
use bevy_log::info;
use navara_core::{
    ease_out_circ, east_north_up_to_fixed_frame, vec3_to_xyz, xyz_to_vec3, Angle, Ellipsoid, Ray,
    CRS, WGS84_32,
};
use navara_frame::FrameManager;
use navara_math::{EqualEpsilon, FloatType, Mat3, Quat, Transform, Vec2, Vec3, EPSILON3, EPSILON6};
use navara_window::Window;

use crate::{
    helpers::{
        get_heading, get_pick_ray_from_camera, get_pitch, get_roll, ray_ellipsoid_intersect,
    },
    CamDirType, CameraController, CameraDirection, CameraEvent, CameraFlight, CameraInertia,
    CameraOrientation, CameraStatus, CameraStatusType,
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
            100.,
            1e8,
            // This is for frustum culling, so need to organize
            Angle::new(50.).rad().val(),
            1.,
            1.1,
        ),
        CameraController::default(),
        CameraInertia::default(),
        CameraFlight::default(),
        CameraStatus::default(),
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
            &mut CameraFlight,
            &mut CameraStatus,
        ),
        With<CameraMarker>,
    >,
    mb: Res<ButtonInput<MouseButton>>,
    mut mm: EventReader<MouseMotion>,
    mut mw: EventReader<MouseWheel>,
    mut _mp: EventReader<MouseMoveInput>,
    mut ce: EventReader<CameraEvent>,
    keys: Res<ButtonInput<KeyCode>>,
    frame: Res<FrameManager>,
) {
    let updated_at = frame.updated_at();
    let last_updated_at = frame.last_updated_at();
    let duration = (updated_at - last_updated_at) as f32;
    for (
        marker,
        mut transform,
        mut controller,
        mut inertia,
        frustum,
        mut orbit,
        mut flight,
        mut cam_st,
    ) in query.iter_mut()
    {
        if !controller.enabled {
            continue;
        }

        let is_cam_moving = is_camera_moving(&inertia, &controller);
        if cam_st.initialized {
            cam_st.status.clear();
        }

        // flying
        if let Some((position, orientation)) = flight.update(duration) {
            apply_camera_change(
                &mut transform,
                &mut orbit,
                &Some(position),
                &Some(orientation),
            );

            if flight.is_flying() {
                cam_st.status.push(CameraStatusType::Moving);
            } else {
                cam_st.status.push(CameraStatusType::MoveEnd);

                orbit.fixed_rotation_axis = None;
                orbit.fixed_rotation_pivot = None;
            };

            // Avoid other camera operations during flight.
            continue;
        }

        // Handle camera events (Change, Translate, FlyTo, LookAt)
        let ce = ce.read().last();
        if let Some(ce) = ce {
            process_camera_event(
                &window,
                ce,
                &mut transform,
                &mut orbit,
                &mut inertia,
                frustum,
                &mut flight,
                &mut cam_st,
                &controller,
                is_cam_moving,
            );
        }

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
            is_cam_moving,
            &mut cam_st,
        );

        handle_zoom(
            &transform,
            &mut orbit,
            &controller,
            &mut inertia,
            &mut mw,
            is_ctrl,
            is_cam_moving,
            &mut cam_st,
        );

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
            is_cam_moving,
            &mut cam_st,
        );

        // Apply inertia
        apply_inertia(&mut orbit, &mut inertia, &controller, &transform);

        if needs_update(&inertia, &controller) || window.is_changed() || marker.is_added() {
            commit(&mut transform, &mut orbit);

            orbit.fixed_rotation_axis = None;
            orbit.fixed_rotation_pivot = None;
        }

        if inertia.translate_time < controller.translate_duration {
            apply_camera_translate(&mut transform, &mut inertia, &controller);

            orbit.fixed_rotation_axis = None;
            orbit.fixed_rotation_pivot = None;
        }

        after_inertia(&mut inertia, duration, &mut controller, &mut cam_st);

        orbit.update_horizontal_rotation_axis_on_tilt(&transform);

        if !cam_st.initialized {
            cam_st.initialized = true;
            // Set initial camera move status if camera status is empty.
            if cam_st.status.is_empty() {
                cam_st.status.push(CameraStatusType::MoveEnd);
            }
        }
    }
}

#[allow(clippy::too_many_arguments)]
fn process_camera_event(
    window: &Window,
    ce: &CameraEvent,
    transform: &mut Transform,
    orbit: &mut Orbit,
    inertia: &mut CameraInertia,
    frustum: &CameraFrustum,
    flight: &mut CameraFlight,
    cam_st: &mut CameraStatus,
    controller: &CameraController,
    is_cam_moving: bool,
) {
    match ce {
        CameraEvent::Change {
            position,
            orientation,
        } => {
            apply_camera_change(transform, orbit, position, orientation);

            // stop camera movement when changing position or orientation
            inertia.stop_all(controller);
            cam_st.status.push(CameraStatusType::Change);
            if is_cam_moving {
                cam_st.status.push(CameraStatusType::MoveEnd);
            }

            orbit.fixed_rotation_axis = None;
            orbit.fixed_rotation_pivot = None;
        }
        CameraEvent::Translate { amount, direction } => {
            if handle_camera_translate(transform, orbit, inertia, amount, direction)
                && !is_cam_moving
            {
                cam_st.status.push(CameraStatusType::MoveStart);
            }
        }
        CameraEvent::FlyTo {
            position,
            orientation,
            duration,
            max_height,
        } => {
            if let Some(pos) = position {
                let orient = orientation.unwrap_or(CameraOrientation::default());
                if flight.fly_to(transform, frustum, pos, &orient, duration, max_height) {
                    // Start the flight animation and stop current inertia
                    inertia.stop_all(controller);
                    if is_cam_moving {
                        cam_st.status.push(CameraStatusType::Moving);
                    } else {
                        cam_st.status.push(CameraStatusType::MoveStart);
                    }
                }
            }
        }
        CameraEvent::LookAt { target, offset } => {
            apply_look_at(transform, orbit, target, offset);

            // stop camera movement when looking at a target
            inertia.stop_all(controller);
            cam_st.status.push(CameraStatusType::LookAt);
            if is_cam_moving {
                cam_st.status.push(CameraStatusType::MoveEnd);
            }

            orbit.fixed_rotation_axis = None;
            orbit.fixed_rotation_pivot = None;
        }
        CameraEvent::RotateAroundAxis { axis, angle } => {
            // don't rotate if the camera is moving
            if !is_cam_moving {
                rotate_around_axis(window, transform, orbit, frustum, axis, angle);
                cam_st.status.push(CameraStatusType::Rotate);
            }
        }
    }
}

fn is_camera_moving(inertia: &CameraInertia, controller: &CameraController) -> bool {
    inertia.spin_time < controller.spin_duration
        || inertia.zoom_time < controller.zoom_duration
        || inertia.translate_time < controller.translate_duration
}

fn commit(transform: &mut Transform, orbit: &mut Orbit) {
    let quat = orbit.horizon_quat * orbit.vertical_quat;
    let rotated_local_position = quat * orbit.local_position;
    let rotated_local_up = quat * orbit.local_up;
    let rotated_local_forward = quat * orbit.local_forward;

    let world_position = orbit.pivot + (orbit.world_quat * rotated_local_position);
    let world_up = orbit.world_quat * rotated_local_up;
    let world_forward = orbit.world_quat * rotated_local_forward;

    transform.translation = world_position;
    transform.look_to(world_forward, world_up);
}

#[allow(clippy::too_many_arguments)]
fn handle_orbit_spin(
    transform: &Transform,
    orbit: &mut Orbit,
    controller: &mut CameraController,
    inertia: &mut CameraInertia,
    mb: &Res<ButtonInput<MouseButton>>,
    mm: &mut EventReader<MouseMotion>,
    is_ctrl: bool,
    is_cam_moving: bool,
    cam_st: &mut CameraStatus,
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

    let world = orbit.get_default_world_quat();
    orbit.set_quat(transform, world, Vec3::ZERO, false);

    let distance_from_ellipsoid_surface = calc_distance_from_ellipsoid_surface(transform, WGS84_32);

    let ratio = distance_from_ellipsoid_surface.abs() / controller.minimum_zoom_distance;
    let clamped_ratio = ratio.max(0.0004);
    // info!("ratio before: {}, ratio after: {}", ratio, clamped_ratio);

    let Some(spin) = rotate(mm, controller, clamped_ratio * 1.5, clamped_ratio) else {
        return;
    };

    if !is_cam_moving {
        cam_st.status.push(CameraStatusType::MoveStart);
    }

    inertia.spin(spin);
}

fn get_fixed_rotation_axis_and_pivot(
    window: &Window,
    transform: &Transform,
    frustum: &CameraFrustum,
    orbit: &mut Orbit,
) -> (Vec3, Vec3) {
    // Use fixed axis and pivot if they exist, otherwise calculate new ones
    if let (Some(fixed_axis), Some(fixed_pivot)) =
        (orbit.fixed_rotation_axis, orbit.fixed_rotation_pivot)
    {
        (fixed_axis, fixed_pivot)
    } else {
        // Calculate new fixed axis and pivot based on screen center intersection
        let center_2d = Vec2::new(window.raw_width() / 2., window.raw_height() / 2.);
        let ray = get_pick_ray_from_camera(window, transform, frustum, center_2d);
        if let Some(t) = ray_ellipsoid_intersect(&ray, WGS84_32) {
            let hit = ray.get_point(t);
            let n_xyz = WGS84_32.geodetic_surface_normal_from_vec3(vec3_to_xyz(hit));
            let n = xyz_to_vec3(n_xyz).normalize_or_zero();

            // Store the surface point as fixed pivot for all future rotations
            orbit.fixed_rotation_axis = Some(n);
            orbit.fixed_rotation_pivot = Some(hit);

            (n, hit)
        } else {
            // No intersection found, use rotation axis through Earth's core with camera up direction
            let axis = transform.up().as_vec3(); // Camera up direction (screen up)
            let pivot = Vec3::ZERO; // Earth's core as pivot

            orbit.fixed_rotation_axis = Some(axis);
            orbit.fixed_rotation_pivot = Some(pivot);

            (axis, pivot)
        }
    }
}

/// Compute the signed angle (in radians) to rotate `v_from` onto `v_to` around a given `axis`.
///
/// The angle is positive if the rotation from `v_from` to `v_to` follows the right-hand rule
/// around `axis`, and negative otherwise. Both input vectors and the axis are normalized
/// internally. The result is in the range [-π, π].
fn signed_angle_around(v_from: Vec3, v_to: Vec3, axis: Vec3) -> f32 {
    let from_n = v_from.normalize_or_zero();
    let to_n = v_to.normalize_or_zero();
    let ax_n = axis.normalize_or_zero();
    let s = from_n.cross(to_n).dot(ax_n);
    let c = from_n.dot(to_n).clamp(-1.0, 1.0);
    s.atan2(c)
}

fn rotate_around_axis(
    window: &Window,
    transform: &mut Transform,
    orbit: &mut Orbit,
    frustum: &CameraFrustum,
    axis: &Option<Vec3>,
    angle: &FloatType,
) {
    if angle.abs() < EPSILON6 {
        return;
    }

    // If a rotation axis is specified, rotate around that axis with the Vec3::ZERO as the pivot.
    if let Some(axis) = axis {
        let a = axis.normalize_or_zero();
        if a.length_squared() == 0.0 {
            return;
        }

        let rotation = Quat::from_axis_angle(a, *angle);

        transform.translation = rotation * transform.translation;
        transform.rotation = (rotation * transform.rotation).normalize();

        orbit.tilt_quat = rotation;
        orbit.tilting = true;
        orbit.update_horizontal_rotation_axis_on_tilt(transform);

        return;
    }

    // If no rotation axis is specified, obtain the intersection of the screen center and the ground surface as the pivot,
    // and use the surface normal at the intersection point as the rotation axis.
    let (axis, pivot_point) = get_fixed_rotation_axis_and_pivot(window, transform, frustum, orbit);
    if axis.length_squared() == 0.0 {
        return;
    }

    let rotation = Quat::from_axis_angle(axis, *angle);
    let old_pos = transform.translation;
    let offset = old_pos - pivot_point;

    // Check if camera is nearly on the rotation axis (singular case)
    let is_singular =
        offset.length_squared() == 0.0 || axis.dot(offset.normalize_or_zero()).abs() > 0.9999;

    // Update position
    transform.translation = pivot_point + rotation * offset;

    if is_singular {
        // Singular case: just rotate orientation
        transform.rotation = (rotation * transform.rotation).normalize();
    } else {
        // Normal case: look at pivot point while preserving roll
        let old_forward = (pivot_point - old_pos).normalize_or_zero();
        let old_up = transform.up().as_vec3();

        // Project `axis` onto the plane orthogonal to `old_forward` and normalize it.
        // (i.e. the component of `axis` perpendicular to the viewing direction,
        //      used as a stable reference "up" vector relative to the forward direction)
        let up_ref = (axis - old_forward * old_forward.dot(axis)).normalize_or_zero();
        let roll = if up_ref.length_squared() > EPSILON6 {
            signed_angle_around(up_ref, old_up, old_forward)
        } else {
            0.0
        };

        // Look at pivot with roll compensation
        let new_forward = (pivot_point - transform.translation).normalize_or_zero();
        transform.look_to(new_forward, axis);

        if roll.abs() > EPSILON6 {
            let roll_rotation = Quat::from_axis_angle(new_forward, roll);
            transform.rotation = (roll_rotation * transform.rotation).normalize();
        }
    }

    orbit.tilt_quat = rotation;
    orbit.tilting = true;
    orbit.update_horizontal_rotation_axis_on_tilt(transform);
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
    is_cam_moving: bool,
    cam_st: &mut CameraStatus,
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

    let center_2d = Vec2::new(window.raw_width() / 2., window.raw_height() / 2.);
    let ray = get_pick_ray_from_camera(window, transform, frustum, center_2d);
    // TODO: Support movement underground.
    let Some(point) = ray_ellipsoid_intersect(&ray, ellipsoid) else {
        // No intersection found, cannot tilt
        return;
    };

    let center = ray.get_point(point);
    let enu_transform = east_north_up_to_fixed_frame(center, ellipsoid);

    if orbit.default_world_quat.is_none() {
        orbit.default_world_quat = Some(orbit.world_quat);
    }

    orbit.set_quat(transform, Quat::from_mat4(&enu_transform), center, true);

    let Some(spin) = rotate(mm, controller, 1., 1.) else {
        return;
    };

    if !is_cam_moving {
        cam_st.status.push(CameraStatusType::MoveStart);
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
#[allow(clippy::too_many_arguments)]
fn handle_zoom(
    transform: &Transform,
    orbit: &mut Orbit,
    controller: &CameraController,
    inertia: &mut CameraInertia,
    mw: &mut EventReader<MouseWheel>,
    is_ctrl: bool,
    is_cam_moving: bool,
    cam_st: &mut CameraStatus,
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
    orbit.set_quat(transform, world, Vec3::ZERO, false);

    let distance_from_ellipsoid_surface = calc_distance_from_ellipsoid_surface(transform, WGS84_32);

    let dist = distance_from_ellipsoid_surface.max(0.);
    let d = zoom * controller.zoom_speed * dist * 0.0025;

    if !is_cam_moving {
        cam_st.status.push(CameraStatusType::MoveStart);
    }

    inertia.zoom(d);
}

fn calc_distance_from_ellipsoid_surface(transform: &Transform, ellipsoid: Ellipsoid<f32>) -> f32 {
    let camera_pos = transform.transform_point(Vec3::ZERO);
    let direction_to_center = -camera_pos.normalize();

    let ray = Ray {
        origin: camera_pos,
        direction: direction_to_center,
    };
    ray_ellipsoid_intersect(&ray, ellipsoid).unwrap_or(0.)
}

fn apply_inertia(
    orbit: &mut Orbit,
    inertia: &mut CameraInertia,
    controller: &CameraController,
    transform: &Transform,
) {
    apply_spin(orbit, inertia, controller, transform);
    apply_zoom(orbit, inertia, controller);
}

const MAX_SPIN_ANGLE: f32 = PI / 30.;

fn apply_spin(
    orbit: &mut Orbit,
    inertia: &mut CameraInertia,
    controller: &CameraController,
    transform: &Transform,
) {
    let t = inertia.spin_time / controller.spin_duration;
    if t > 1.0 {
        return;
    }
    
    let mut next = inertia.spin * (1.0 - ease_out_circ(t));

    next.y = next.y.clamp(-MAX_SPIN_ANGLE, MAX_SPIN_ANGLE);
    next.x = next.x.clamp(-MAX_SPIN_ANGLE, MAX_SPIN_ANGLE);

    info!("delta x: {}, delta y: {}", inertia.spin.x.to_degrees(), inertia.spin.y.to_degrees());

    orbit.horizon_quat *= Quat::from_axis_angle(orbit.horizontal_rotation_axis, next.x);

    let vertical_delta = Quat::from_axis_angle(orbit.vertical_rotation_axis, next.y);

    let inverse = orbit.world_quat.inverse();

    let local_camera_forward = inverse * transform.forward().as_vec3();

    let next_vert_quat = orbit.vertical_quat * vertical_delta;
    let next_up = next_vert_quat * Vec3::Z;
    let next_forward = next_vert_quat * local_camera_forward;
    let next_align = next_forward.dot(next_up);

    // Restrict the vertical rotation near the poles.
    if next_align.abs() > 0.995 {
        let y = inertia.spin.y;
        let is_vertical_rotation_skipped =
            (next_align < 0. && y < 0.) || (next_align > 0. && y > 0.);
        if is_vertical_rotation_skipped {
            return;
        }
    }
    orbit.vertical_quat = next_vert_quat;
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

fn after_inertia(
    inertia: &mut CameraInertia,
    duration: f32,
    controller: &mut CameraController,
    cam_st: &mut CameraStatus,
) {
    if inertia.spin_time < controller.spin_duration {
        inertia.spin_time += duration;

        if inertia.spin_time < controller.spin_duration {
            if !cam_st.status.contains(&CameraStatusType::MoveStart) {
                cam_st.status.push(CameraStatusType::Moving);
            }
        } else {
            cam_st.status.push(CameraStatusType::MoveEnd);
        }
    }
    if inertia.zoom_time < controller.zoom_duration {
        inertia.zoom_time += duration;

        if inertia.zoom_time < controller.zoom_duration {
            if !cam_st.status.contains(&CameraStatusType::MoveStart) {
                cam_st.status.push(CameraStatusType::Moving);
            }
        } else {
            cam_st.status.push(CameraStatusType::MoveEnd);
        }
    }
    if inertia.translate_time < controller.translate_duration {
        inertia.translate_time += duration;

        if inertia.translate_time < controller.translate_duration {
            if !cam_st.status.contains(&CameraStatusType::MoveStart) {
                cam_st.status.push(CameraStatusType::Moving);
            }
        } else {
            cam_st.status.push(CameraStatusType::MoveEnd);
        }
    }
}

/// Applies a camera change based on geographic position, heading, and pitch.
///
/// - `cc.position.xy`: longitude & latitude
/// - `cc.position.z`: camera height above the ground point (along normal)
/// - `cc.heading`: rotation around the local up axis (degrees)
/// - `cc.pitch`: tilt around the camera's right axis (degrees)
fn apply_camera_change(
    transform: &mut Transform,
    orbit: &mut Orbit,
    position: &Option<Vec3>,
    orientation: &Option<CameraOrientation>,
) {
    let orient = orientation.unwrap_or_default();

    // Heading is inverted because positive rotation should be clockwise
    let heading = if orient.heading.is_some() {
        -orient.get_heading()
    } else {
        -get_heading(transform)
    };

    // Pitch is adjusted by +90° because we want -90° to point straight down
    let pitch = if orient.pitch.is_some() {
        orient.get_pitch() + 90.0
    } else {
        get_pitch(transform) + 90.0
    };

    let roll = if orient.roll.is_some() {
        orient.get_roll()
    } else {
        get_roll(transform)
    };

    // Reset orbit to default state before applying changes
    *orbit = Orbit::default();

    // Calculate new world position and target direction
    // This differs based on whether we have a new position or are using existing one
    let (world_position, target_dir) = if let Some(pos) = position {
        let altitude = pos.z.max(1.0); // Ensure minimum altitude of 1.0 for stability

        // Create ground point (ignoring altitude for now)
        let ground_point = Vec3::new(pos.x, pos.y, 0.0);
        // Convert geographic coordinates to world-space position
        let pivot = CRS::Geographic.to_vec3(WGS84_32, ground_point, 0.0);
        let target_dir = pivot.normalize_or_zero();

        // Calculate camera offset from ground point
        let cam_offset = -Vec3::Y * altitude;
        let world_quat = calculate_world_quat(target_dir, heading);

        // Final world position is ground point plus camera offset
        (pivot + (world_quat * cam_offset), target_dir)
    } else {
        // When no position provided, use existing transform position
        let mut position = transform.translation;
        if position == Vec3::ZERO {
            position = orbit.local_position; // Fallback to orbit's default position
        }
        (position, position.normalize_or_zero())
    };

    // Calculate orientation quaternion based on target direction
    let world_quat = calculate_world_quat(target_dir, heading);

    // Apply pitch and roll rotations to forward and up vectors
    let (world_forward, world_up) =
        apply_orientation_changes(world_quat, orbit.local_forward, orbit.local_up, pitch, roll);

    // Update transform with new position and orientation
    transform.translation = world_position;
    transform.look_to(world_forward, world_up);

    // Update orbit state with new quaternion
    orbit.set_quat(transform, world_quat, Vec3::ZERO, false);
}

/// Calculates the world rotation quaternion based on target direction and heading
/// Handles special case when looking directly up/down (Z-axis)
fn calculate_world_quat(target_dir: Vec3, heading: f32) -> Quat {
    // Calculate right vector - special case when looking straight up/down
    let right = if target_dir.abs_diff_eq(Vec3::Z, EPSILON3)
        || target_dir.abs_diff_eq(-Vec3::Z, EPSILON3)
    {
        Vec3::X // Default right vector when looking straight up/down
    } else {
        target_dir.cross(Vec3::Z).normalize_or_zero() // Standard right vector
    };

    // Calculate up vector from right and target direction
    let up = right.cross(target_dir).normalize_or_zero();

    // Create rotation matrix from coordinate system axes
    let rot_mat = Mat3::from_cols(right, target_dir, up);

    // Default camera orientation (looking down negative Y axis)
    let default_quat = Quat::from_mat3(&Mat3::from_cols(Vec3::NEG_X, Vec3::NEG_Y, Vec3::Z));

    // Create heading rotation around target direction
    let heading_quat = Quat::from_axis_angle(target_dir, heading.to_radians());

    // Combine rotations: heading × local rotation × default orientation
    heading_quat * Quat::from_mat3(&rot_mat) * default_quat
}

/// Applies pitch and roll rotations to orientation vectors
/// Returns modified forward and up vectors
fn apply_orientation_changes(
    world_quat: Quat,
    local_forward: Vec3,
    local_up: Vec3,
    pitch: f32,
    roll: f32,
) -> (Vec3, Vec3) {
    // Transform local vectors to world space
    let mut world_up = world_quat * local_up;
    let mut world_forward = world_quat * local_forward;

    // Calculate camera right vector for pitch rotation
    let camera_right = world_forward.cross(world_up).normalize_or_zero();

    // Apply pitch rotation (tilt up/down around right axis)
    let pitch_quat = Quat::from_axis_angle(camera_right, pitch.to_radians());
    world_forward = pitch_quat * world_forward;
    world_up = pitch_quat * world_up;

    // Apply roll rotation (tilt side-to-side around forward axis)
    let roll_quat = Quat::from_axis_angle(world_forward, roll.to_radians());
    world_up = roll_quat * world_up;

    (world_forward, world_up)
}

fn handle_camera_translate(
    transform: &mut Transform,
    orbit: &mut Orbit,
    inertia: &mut CameraInertia,
    amount: &f32,
    direction: &CamDirType,
) -> bool {
    if *amount < EPSILON3 {
        return false;
    }

    // Get the camera's local forward, right, and up directions
    let forward = transform.forward().as_vec3();
    let right = transform.right().as_vec3();
    let up = transform.up().as_vec3();

    // Determine the movement direction vector based on the input direction
    let dir_vec = match direction {
        CamDirType::Standard(CameraDirection::Forward) => forward,
        CamDirType::Standard(CameraDirection::Backward) => -forward,
        CamDirType::Standard(CameraDirection::Right) => right,
        CamDirType::Standard(CameraDirection::Left) => -right,
        CamDirType::Standard(CameraDirection::Up) => up,
        CamDirType::Standard(CameraDirection::Down) => -up,
        CamDirType::Custom(dir) => dir.normalize_or_zero(),
    };

    // Move the camera by the specified amount in the chosen direction
    inertia.translate(dir_vec * amount);

    // Reapply the orbit rotation to maintain a consistent view orientation
    let world = orbit.get_default_world_quat();
    orbit.set_quat(transform, world, Vec3::ZERO, false);

    true
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

fn apply_look_at(transform: &mut Transform, orbit: &mut Orbit, target: &Vec3, offset: &Vec3) {
    let ellipsoid = WGS84_32;
    let world_target = CRS::Geographic.to_vec3(ellipsoid, *target, 0.0);

    let enu_transform = east_north_up_to_fixed_frame(world_target, ellipsoid);
    let offset_world = enu_transform.transform_vector3(*offset);

    let camera_position = world_target + offset_world;

    let forward = (world_target - camera_position).normalize();
    let mut up = enu_transform.transform_vector3(Vec3::Z).normalize();

    // Handle edge case where forward and up vectors are colinear (or nearly so)
    if forward
        .dot(up)
        .clamp(-1.0, 1.0)
        .abs()
        .equal_diff_epsilon(1.0, EPSILON6)
    {
        up = enu_transform.transform_vector3(Vec3::Y).normalize();
    }

    transform.translation = camera_position;
    transform.look_to(forward, up);

    let world = orbit.get_default_world_quat();
    orbit.set_quat(transform, world, Vec3::ZERO, false);
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
