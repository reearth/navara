use bevy_ecs::{
    event::EventReader,
    query::Changed,
    system::{Commands, Query, Res},
};
use bevy_input::{
    keyboard::KeyCode,
    mouse::{MouseButton, MouseMotion, MouseWheel},
    Input,
};
use bevy_math::{Quat, Vec2, Vec3};
use navara_core::{Angle, EARTH_RADIUS_F32};

use crate::Transform;

use super::{CameraFrustum, CameraMarker, Orbit};
use crate::MouseMoveInput;

pub fn startup(mut commands: Commands) {
    let earth_radius = EARTH_RADIUS_F32;
    let translation = Vec3::ZERO;
    let transform = Transform::from_translation(translation);
    commands.spawn((
        CameraMarker,
        Orbit {
            r: earth_radius * 3.,
            quat: Quat::from_axis_angle(Vec3::Y, 0.0),
            tilt: 0.0,
        },
        transform,
        CameraFrustum::new(&transform, 0.1, 1e8, Angle::new(50.).rad().val(), 1.),
    ));
}

pub fn update(
    mut query: Query<(&mut Transform, &mut Orbit, &CameraMarker)>,
    mb: Res<Input<MouseButton>>,
    mut mm: EventReader<MouseMotion>,
    mut mw: EventReader<MouseWheel>,
    mut mp: EventReader<MouseMoveInput>,
    keys: Res<Input<KeyCode>>,
) {
    for (mut transform, mut orbit, _) in query.iter_mut() {
        let is_ctrl = keys.pressed(KeyCode::ControlLeft) || keys.pressed(KeyCode::ControlRight);

        // arc
        if mb.pressed(MouseButton::Left) && !is_ctrl {
            // fetch amount of cursor movement
            let mut screen_delta = Vec3::ZERO;
            for ev in mm.read() {
                screen_delta += Vec3::new(ev.delta.x, ev.delta.y, 0.0);
            }
            // correct amount of pan by radius of the orbit
            let ratio = orbit.r / EARTH_RADIUS_F32;
            let distance = orbit.r - EARTH_RADIUS_F32;
            let pan_delta = Vec2::new(
                (screen_delta.x * ratio / EARTH_RADIUS_F32).atan() * distance,
                (screen_delta.y * ratio / EARTH_RADIUS_F32).atan() * distance,
            );
            orbit.quat *= Quat::from_rotation_z(pan_delta.y);
            orbit.quat *= Quat::from_rotation_x(pan_delta.x);
        }

        // dolly
        {
            let mut dolly_delta = Vec3::ZERO;
            for ev in mw.read() {
                dolly_delta += Vec3::new(ev.x, ev.y, 0.0);
            }

            let speed = 100.;

            let ratio = orbit.r / EARTH_RADIUS_F32;
            let d = dolly_delta.y * (speed * ratio);
            // avoid to get camera inside the earth
            orbit.r = if orbit.r + d < (EARTH_RADIUS_F32 + 1.) {
                EARTH_RADIUS_F32 + 1.
            } else {
                orbit.r + d
            };
        }

        // rotation
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
            transform.rotate_local_z(rot);
        }

        // tilt
        if is_ctrl && mb.pressed(MouseButton::Left) {
            // fetch amount of cursor movement
            let screen_delta = mm.read().fold(0.0, |x, ev| x + ev.delta.y);
            orbit.tilt += screen_delta * EARTH_RADIUS_F32;
        }

        transform.translation = orbit.to_vec3();
        let up = transform.up();
        transform.look_at(orbit.quat * Vec3::X * orbit.tilt, up);
    }
}

pub(super) fn update_frustum(
    mut camera: Query<(&CameraMarker, &mut CameraFrustum, &mut Transform), Changed<Transform>>,
) {
    for (_, mut frustum, transform) in &mut camera {
        frustum.update_sse_denominator();
        frustum.update_planes(&transform);
    }
}
