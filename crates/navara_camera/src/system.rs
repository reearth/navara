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
use navara_core::{east_north_up_to_fixed_frame, ray_ellipsoid, Angle, Intersection, WGS84_32};
use navara_math::{Mat3, Quat, Transform, Vec2, Vec3, EPSILON10};
use navara_window::Window;

use crate::{helpers::get_pick_ray_from_camera, CameraController, CameraInertia};

use super::{CameraFrustum, CameraMarker, Orbit};
use navara_input::MouseMoveInput;

pub fn startup(mut commands: Commands) {
    let controller = CameraController::default();

    let r = controller.minimum_zoom_distance * 3.;

    let orbit = Orbit {
        quat: Quat::IDENTITY,
        world_quat: Quat::from_mat3(&Mat3::from_cols(Vec3::NEG_X, Vec3::NEG_Y, Vec3::Z)),
        default_world_quat: None,
        local_up: Vec3::Z,
        local_position: Vec3::NEG_Y * r,
        local_forward: Vec3::Y,
        vertical_axis: Vec3::NEG_X,
        horizontal_axis: Vec3::Z,
        pivot: Vec3::ZERO,
        should_tilt: false,
    };

    let transform = Transform::default();

    commands.spawn((
        CameraMarker,
        orbit.clone(),
        transform,
        CameraFrustum::new(
            &transform,
            0.1,
            1e8,
            // This is for frustum culling, so need to organize
            Angle::new(50.).rad().val(),
            1.,
            1.3,
        ),
        CameraController::default(),
        CameraInertia::default(),
    ));
}

#[allow(clippy::type_complexity)]
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
    keys: Res<ButtonInput<KeyCode>>,
) {
    for (marker, mut transform, mut controller, mut inertia, frustum, mut orbit) in query.iter_mut()
    {
        if !controller.enabled {
            continue;
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

        if needs_update(&inertia) || window.is_changed() || marker.is_added() {
            commit(&mut transform, &mut orbit);
        }

        after_inertia(&mut inertia, &controller);
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

    inertia.spin = rotate(
        mm,
        controller,
        (orbit.local_position.length() - controller.minimum_zoom_distance)
            / controller.minimum_zoom_distance,
    );
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

    controller.is_tilting = true;

    let center_2d = Vec2::new(window.raw_width() / 2., window.raw_height() / 2.);
    let ray = get_pick_ray_from_camera(window, transform, frustum, center_2d);
    // TODO: Support movement underground.
    let intersection = match ray_ellipsoid(&ray, ellipsoid) {
        Some(i) if i.start != 0. => i,
        // TODO: Handle the case where intersection point couldn't find.
        // Ref: https://github.com/CesiumGS/cesium/blob/57857b0d563d0d7592fe6254080c22130ce8d3ed/packages/engine/Source/Scene/ScreenSpaceCameraController.js#L2487-L2515
        _ => Intersection { start: 1., end: 1. },
    };
    let center = ray.get_point(intersection.start);
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

    inertia.spin = rotate(mm, controller, 1.);
}

fn rotate(mm: &mut EventReader<MouseMotion>, controller: &CameraController, ratio: f32) -> Vec3 {
    let mut screen_delta = Vec3::ZERO;
    for ev in mm.read() {
        screen_delta += Vec3::new(ev.delta.x, ev.delta.y, 0.0);
    }

    let pan_delta = Vec2::new(screen_delta.x * ratio, screen_delta.y * ratio);

    Vec3::new(-pan_delta.x, -pan_delta.y, 0.0) * controller.spin_speed
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

    let mut zoom = 0.0;
    for ev in mw.read() {
        zoom += ev.y;
    }

    let world = orbit.get_default_world_quat();
    orbit.set_quat(transform, world, Vec3::ZERO, false, None);

    let length = orbit.local_position.length();

    let dist = (length - controller.minimum_zoom_distance).max(0.);
    let d = zoom * controller.zoom_speed * dist * 0.0025;

    inertia.zoom = d;
}

fn apply_inertia(orbit: &mut Orbit, inertia: &mut CameraInertia, controller: &CameraController) {
    apply_move(orbit, inertia);
    apply_zoom(orbit, inertia, controller);
}

fn apply_move(orbit: &mut Orbit, inertia: &mut CameraInertia) {
    let vertical = Quat::from_axis_angle(orbit.vertical_axis, inertia.spin.y);
    let horizontal = Quat::from_axis_angle(orbit.horizontal_axis, inertia.spin.x);
    orbit.quat *= horizontal * vertical;
}

fn apply_zoom(orbit: &mut Orbit, inertia: &mut CameraInertia, controller: &CameraController) {
    let next = orbit.local_position - orbit.local_forward * inertia.zoom;
    let length = next.length();
    if length >= controller.maximum_zoom_distance && inertia.zoom > 0. {
        return;
    }
    if length <= controller.minimum_zoom_distance && inertia.zoom < 0. {
        return;
    }
    orbit.local_position = next;
}

fn needs_update(inertia: &CameraInertia) -> bool {
    inertia.spin.length().abs() >= EPSILON10
        || inertia.zoom.abs() >= EPSILON10
        || inertia.tilt.length().abs() >= EPSILON10
}

fn after_inertia(inertia: &mut CameraInertia, controller: &CameraController) {
    inertia.spin *= controller.inertia;
    inertia.zoom *= controller.inertia;
    inertia.tilt *= controller.inertia;
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
