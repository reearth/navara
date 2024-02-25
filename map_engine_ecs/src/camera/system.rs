use bevy_ecs::{
    component::Component,
    event::EventReader,
    system::{Commands, Query, Res},
};
use bevy_input::{
    mouse::{MouseButton, MouseMotion, MouseWheel},
    Input,
};
use bevy_log::info;
use bevy_math::Vec3;
use bevy_time::Time;

use crate::Transform;

use super::CameraMarker;

pub fn startup(mut commands: Commands) {
    let translation = Vec3::ZERO;
    commands.spawn((
        CameraMarker,
        Orbit {
            r: 1000.0,
            theta: 0.0,
            phi: 0.0,
        },
        Transform::from_translation(translation),
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
    mut query: Query<(&mut Transform, &mut Orbit, &CameraMarker)>,
    mb: Res<Input<MouseButton>>,
    mut mm: EventReader<MouseMotion>,
    mut mw: EventReader<MouseWheel>,
) {
    for (mut transform, mut orbit, _) in query.iter_mut() {
        let mut pan_delta = Vec3::ZERO;
        let mut dolly_delta = Vec3::ZERO;

        if mb.pressed(MouseButton::Left) {
            for ev in mm.read() {
                pan_delta += Vec3::new(ev.delta.x, ev.delta.y, 0.0);
            }
        } 
        
        {
            for ev in mw.read() {
                dolly_delta += Vec3::new(ev.x, ev.y, 0.0);
            }
        }
        
        if pan_delta != Vec3::ZERO {
            info!("pan_delta: {:?}", pan_delta);
        }

        if mb.pressed(MouseButton::Left) {
            let ratio = orbit.r / 300.0;
            orbit.phi += (pan_delta.x * ratio / 300.0).atan() * 200.0;
            orbit.theta -= (pan_delta.y * ratio / 300.0).atan() * 200.0;
        }

        {
            let d = dolly_delta.y;
            // avoid to get camera inside the earth
            orbit.r = if orbit.r + d < 301.0 {
                301.0
            } else {
                orbit.r + d
            };
        }

        transform.translation = orbit.to_vec3();
        transform.look_at(Vec3::ZERO, Vec3::Y);
    }
}

#[derive(Debug, Clone, Copy, Component)]
pub struct Orbit {
    pub r: f32,
    pub theta: f32,
    pub phi: f32,
}

impl Orbit {
    fn to_vec3(self) -> Vec3 {
        let x = self.r * self.theta.sin() * self.phi.cos();
        let y = self.r * self.theta.cos();
        let z = self.r * self.theta.sin() * self.phi.sin();
        Vec3::new(x, y, z)
    }
}
