use bevy_ecs::{
    event::EventReader,
    query::Changed,
    system::{Commands, Query, Res},
};
use bevy_input::{
    keyboard::KeyCode,
    mouse::{MouseButton, MouseMotion, MouseWheel},
    ButtonInput,
};
use navara_core::{Angle, EARTH_RADIUS_F32};
use navara_math::{Quat, Transform, Vec2, Vec3};

use crate::{Camera, CameraController, CameraInertia};

use super::{CameraFrustum, CameraMarker, Orbit};
use navara_input::MouseMoveInput;

pub fn startup(mut commands: Commands) {
    let earth_radius = EARTH_RADIUS_F32;
    let translation = Vec3::ZERO;
    let transform = Transform::from_translation(translation);
    commands.spawn((
        CameraMarker,
        Camera::default(),
        Orbit {
            r: earth_radius * 3.,
            quat: Quat::from_axis_angle(Vec3::Y, 0.0),
            tilt: 0.0,
            pivot: Vec3::ZERO,
        },
        transform,
        CameraFrustum::new(&transform, 0.1, 1e8, Angle::new(50.).rad().val(), 1.),
        CameraController::default(),
        CameraInertia::default(),
    ));
}

pub fn update(
    mut query: Query<(
        &mut Camera,
        &mut Transform,
        &mut CameraController,
        &mut CameraInertia,
        &mut Orbit,
    )>,
    mb: Res<ButtonInput<MouseButton>>,
    mut mm: EventReader<MouseMotion>,
    mut mw: EventReader<MouseWheel>,
    mut mp: EventReader<MouseMoveInput>,
    keys: Res<ButtonInput<KeyCode>>,
) {
    for (mut camera, mut transform, controller, mut inertia, mut orbit) in query.iter_mut() {
        if !controller.enabled {
            continue;
        }

        let is_ctrl = keys.pressed(KeyCode::ControlLeft) || keys.pressed(KeyCode::ControlRight);

        // Handle rotations and movements
        handle_orbit_rotation(&mut orbit, &controller, &mut inertia, &mb, &mut mm, is_ctrl);
        handle_zoom(&mut orbit, &controller, &mut inertia, &mut mw);
        handle_free_rotation(&mut transform, &controller, &mut inertia, &mb, &mut mp, &mut mm);
        handle_tilt(&mut orbit, &controller, &mb, &mut mm, is_ctrl, &mut transform);

        // Apply inertia
        apply_inertia(&mut orbit, &mut inertia, &controller);

        // Update transform using pivot point
        // need to be moved to update_camera_transform
        transform.translation = orbit.quat * Vec3::new(0.0, 0.0, orbit.r);
        let up = transform.up();
        transform.look_at(orbit.quat * Vec3::X * orbit.tilt, up);

        // Update camera
        camera.update_frustum(&transform);
    }
}


fn handle_orbit_rotation(
    orbit: &mut Orbit,
    controller: &CameraController,
    inertia: &mut CameraInertia,
    mb: &Res<ButtonInput<MouseButton>>,
    mm: &mut EventReader<MouseMotion>,
    is_ctrl: bool,
) {
    if !controller.enable_rotate || !mb.pressed(MouseButton::Left) || is_ctrl {
        return;
    }

    let mut screen_delta = Vec3::ZERO;
    for ev in mm.read() {
        screen_delta += Vec3::new(ev.delta.x, ev.delta.y, 0.0);
    }

    let ratio = orbit.r / EARTH_RADIUS_F32;
    let distance = orbit.r - EARTH_RADIUS_F32;
    let pan_delta = Vec2::new(
        (screen_delta.x * ratio / EARTH_RADIUS_F32).atan() * distance,
        (screen_delta.y * ratio / EARTH_RADIUS_F32).atan() * distance,
    );

    orbit.quat *= Quat::from_rotation_x(-pan_delta.y * controller.rotate_speed);
    orbit.quat *= Quat::from_rotation_y(-pan_delta.x * controller.rotate_speed);
    inertia.spin = Vec3::new(-pan_delta.x, -pan_delta.y, 0.0) * controller.rotate_speed;
}

fn handle_zoom(
    orbit: &mut Orbit, 
    controller: &CameraController,
    inertia: &mut CameraInertia,
    mw: &mut EventReader<MouseWheel>,
) {
    if !controller.enable_zoom {
        return;
    }

    let mut zoom = 0.0;
    for ev in mw.read() {
        zoom += ev.y;
    }

    let ratio = orbit.r / EARTH_RADIUS_F32;
    let d = zoom * (controller.zoom_speed * ratio);
    orbit.r = (orbit.r + d).clamp(controller.minimum_zoom_distance, controller.maximum_zoom_distance);
    inertia.zoom = d;
}


// ref: https://github.com/CesiumGS/cesium/blob/0e9a425b475cd3cfdd90f35e9cdbdda453e448d8/packages/engine/Source/Scene/ScreenSpaceCameraController.js#L2462
fn handle_tilt(
    orbit: &mut Orbit,
    controller: &CameraController,
    mb: &Res<ButtonInput<MouseButton>>,
    mm: &mut EventReader<MouseMotion>,
    is_ctrl: bool,
    _transform: &mut Transform
) {
    if controller.enable_tilt && is_ctrl && mb.pressed(MouseButton::Left) {
        let screen_delta = mm.read().fold(0.0, |x, ev| x + ev.delta.y);
        orbit.tilt += screen_delta * EARTH_RADIUS_F32;
    }

    // if controller.enable_tilt && is_ctrl && mb.pressed(MouseButton::Left) {
    //     let screen_delta = mm.read().fold(0.0, |x, ev| x + ev.delta.y);
        
    //     // Get current tilt direction
    //     let forward = transform.forward();
    //     let current_tilt = (-forward.y).atan2(forward.z);
        
    //     // Compute new tilt angle
    //     let new_tilt = current_tilt + screen_delta * EARTH_RADIUS_F32;
    //     let new_tilt = new_tilt.clamp(-std::f32::consts::FRAC_PI_2, std::f32::consts::FRAC_PI_2);
        
    //     // Compute tilt delta
    //     let tilt_delta = new_tilt - current_tilt;
        
    //     // Apply tilt around local right axis
    //     orbit.tilt = new_tilt;
    // }
}

fn handle_free_rotation( 
    transform: &mut Transform,
    controller: &CameraController,
    inertia: &mut CameraInertia,
    mb: &Res<ButtonInput<MouseButton>>,
    mp: &mut EventReader<MouseMoveInput>,
    mm: &mut EventReader<MouseMotion>,     
) {
    if mb.pressed(MouseButton::Right) {
        let mut rot_pos = Vec2::ZERO;
        for ev in mp.read() {
            rot_pos = Vec2::new(ev.x, ev.y);
        }
        let mut rot_delta = Vec2::ZERO;
        for ev in mm.read() {
            rot_delta += Vec2::new(ev.delta.x, ev.delta.y);
        }
        let pos = Vec2::new(0.5, 0.5) - rot_pos;
        let pos_next = pos + rot_delta;
        let rot = pos_next.angle_between(pos);
        transform.rotate_local_z(rot * controller.spin_speed);
        inertia.spin.z += rot * controller.spin_speed;
    }
}

fn apply_inertia(orbit: &mut Orbit, inertia: &mut CameraInertia, controller: &CameraController) {
    orbit.quat *= Quat::from_rotation_y(inertia.spin.x)
        * Quat::from_rotation_x(inertia.spin.y)
        * Quat::from_rotation_z(inertia.spin.z);

    orbit.r = (orbit.r + inertia.zoom)
        .clamp(controller.minimum_zoom_distance, controller.maximum_zoom_distance);

    inertia.spin *= controller.inertia;
    inertia.zoom *= controller.inertia;
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


pub fn update_frustum(
    mut query: Query<(&Camera, &mut CameraFrustum, &Transform), Changed<Transform>>,
) {
    for (_, mut frustum, transform) in query.iter_mut() {
        frustum.update_sse_denominator();
        frustum.update_planes(transform);
    }
}
