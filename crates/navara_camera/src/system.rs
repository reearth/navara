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

        // Arc rotation
        if controller.enable_rotate && mb.pressed(MouseButton::Left) && !is_ctrl {
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

        // Zoom
        if controller.enable_zoom {
            let mut zoom = 0.0;
            for ev in mw.read() {
                zoom += ev.y;
            }
            let speed = controller.zoom_speed;
            let ratio = orbit.r / EARTH_RADIUS_F32;
            let d = zoom * (speed * ratio);
            orbit.r = (orbit.r + d).clamp(
                controller.minimum_zoom_distance,
                controller.maximum_zoom_distance,
            );
            inertia.zoom = d;
        }

        // Rotation
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

        // Tilt
        if controller.enable_tilt && is_ctrl && mb.pressed(MouseButton::Left) {
            let screen_delta = mm.read().fold(0.0, |x, ev| x + ev.delta.y);
            orbit.tilt += screen_delta * controller.rotate_speed;
            orbit.tilt = orbit
                .tilt
                .clamp(-std::f32::consts::FRAC_PI_2, std::f32::consts::FRAC_PI_2);
        }

        // Apply inertia
        orbit.quat *= Quat::from_rotation_y(inertia.spin.x)
            * Quat::from_rotation_x(inertia.spin.y)
            * Quat::from_rotation_z(inertia.spin.z);
        orbit.r = (orbit.r + inertia.zoom).clamp(
            controller.minimum_zoom_distance,
            controller.maximum_zoom_distance,
        );

        // Decay inertia
        inertia.spin *= controller.inertia;
        inertia.zoom *= controller.inertia;

        // Update transform
        let tilt_quat = Quat::from_rotation_x(orbit.tilt);
        let rotation = orbit.quat * tilt_quat;
        transform.translation = rotation * Vec3::new(0.0, 0.0, orbit.r);
        let up = transform.up();
        transform.look_at(orbit.quat * Vec3::X * orbit.tilt, up);

        // Update camera
        camera.update_frustum(&transform);
    }
}

pub fn update_frustum(
    mut query: Query<(&Camera, &mut CameraFrustum, &Transform), Changed<Transform>>,
) {
    for (_, mut frustum, transform) in query.iter_mut() {
        frustum.update_sse_denominator();
        frustum.update_planes(transform);
    }
}
