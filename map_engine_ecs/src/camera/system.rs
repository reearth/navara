use bevy_ecs::{
    component::Component,
    event::EventReader,
    system::{Commands, Query, Res},
};
use bevy_input::{
    keyboard::KeyboardInput, mouse::{MouseButton, MouseMotion, MouseWheel}, Input
};
use bevy_math::{Vec3, Vec2, Quat};
use bevy_time::Time;

use crate::Transform;

use super::CameraMarker;
use crate::MouseMoveInput;

pub fn startup(mut commands: Commands) {
    let translation = Vec3::ZERO;
    commands.spawn((
        CameraMarker,
        Orbit {
            r: 1000.0,
            quat: Quat::from_axis_angle(Vec3::Y, 0.0),
            tilt: 0.0,
        },
        Transform::from_translation(translation),
        Ctrl{ pressed: 0 },
    ));
}

pub fn example(_time: Res<Time>, mut _query: Query<(&mut Transform, &CameraMarker)>) {
    // let (mut transform, _) = query.single_mut();

    // let sec = 10.0;
    // let radian = time.elapsed_seconds() % sec / sec * std::f32::consts::PI * 2.0;
    // let radius = transform.translation.length();
    // let x = radian.cos() * radius;
    // let z = radian.sin() * radius;

    // transform.translation.x = x;
    // transform.translation.z = z;
    // transform.look_at(Vec3::ZERO, Vec3::Y);
}

pub fn example2(
    mut query: Query<(&mut Transform, &mut Orbit, &CameraMarker, &mut Ctrl)>,
    mb: Res<Input<MouseButton>>,
    mut mm: EventReader<MouseMotion>,
    mut mw: EventReader<MouseWheel>,
    mut mp: EventReader<MouseMoveInput>,
    mut kb: EventReader<KeyboardInput>,
) {
    for (mut transform, mut orbit, _, mut ctrl) in query.iter_mut() {
        // throttled keys
        use bevy_input::keyboard::KeyCode::{*};
        ctrl.pressed = kb.read().fold(ctrl.pressed, |x, ev| {
            match (ev.key_code, ev.state) {
                (Some(ControlLeft | ControlRight), bevy_input::ButtonState::Pressed) => x + 1,
                (Some(ControlLeft | ControlRight), bevy_input::ButtonState::Released) => -1,
                _ => x - 1,
            }
        });
        let is_ctrl = ctrl.pressed > 0;
        ctrl.pressed = if is_ctrl { if ctrl.pressed > 100 {100} else {ctrl.pressed} } else {0};

        // arc
        if mb.pressed(MouseButton::Left) && !is_ctrl {
            // fetch amount of cursor movement
            let mut screen_delta = Vec3::ZERO;
            for ev in mm.read() {
                screen_delta += Vec3::new(ev.delta.x, ev.delta.y, 0.0);
            }
            // correct amount of pan by radius of the orbit
            let ratio = orbit.r / 300.0;
            let pan_delta = Vec2::new(
                (screen_delta.x * ratio / 300.0).atan() * 200.0,
                (screen_delta.y * ratio / 300.0).atan() * 200.0,
            );
            orbit.quat = orbit.quat * Quat::from_rotation_z(pan_delta.y);
            orbit.quat = orbit.quat * Quat::from_rotation_x(pan_delta.x);
        }

        // dolly
        {
            let mut dolly_delta = Vec3::ZERO;
            for ev in mw.read() {
                dolly_delta += Vec3::new(ev.x, ev.y, 0.0);
            }
            let d = dolly_delta.y;
            // avoid to get camera inside the earth
            orbit.r = if orbit.r + d < 301.0 {
                301.0
            } else {
                orbit.r + d
            };
        }

        // rotation
        if mb.pressed(MouseButton::Middle) {
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
            let screen_delta = mm.read().fold(0.0, |x, ev| {
                x + ev.delta.y
            });
            orbit.tilt += screen_delta * 200.0;
        }

        transform.translation = orbit.to_vec3();
        let up = transform.up();
        transform.look_at(orbit.quat * Vec3::X * orbit.tilt, up);
    }
}

#[derive(Debug, Clone, Copy, Component)]
pub struct Orbit {
    pub r: f32,
    pub quat: Quat,
    pub tilt: f32,
}

impl Orbit {
    fn to_vec3(self) -> Vec3 {
        self.quat * Vec3::new(0.0, self.r, 0.0)
    }
}

#[derive(Debug, Clone, Copy, Component)]
pub struct Ctrl{
    pressed: i32,
}