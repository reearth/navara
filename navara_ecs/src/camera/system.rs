use bevy_log::info;
use bevy_ecs::system::{Query, Res};
use bevy_ecs::event::EventReader;
use bevy_input::Input;
use bevy_math::{Quat, Vec3};
use bevy_input::mouse::{MouseButton, MouseMotion, MouseWheel};
use bevy_input::keyboard::KeyCode;
use bevy_time::Time;
use crate::Transform;

use super::comp::*;
use super::CameraFrustum;

pub fn first_person_control_system(
    mut query: Query<(&mut Transform, &FirstPersonControlComponent)>,
    input: Res<Input<KeyCode>>,
    mut mouse_motion_events: EventReader<MouseMotion>,
) {
    for (mut transform, control) in query.iter_mut() {
        for event in mouse_motion_events.read() {
            let delta_yaw = event.delta.x * control.sensitivity;
            let delta_pitch = event.delta.y * control.sensitivity;

            transform.rotation = transform.rotation * Quat::from_rotation_y(delta_yaw);
            transform.rotation = transform.rotation * Quat::from_rotation_x(delta_pitch);
            
            info!("First Person: Rotated camera. Yaw: {}, Pitch: {}", delta_yaw, delta_pitch);
        }

        let mut direction = Vec3::ZERO;

        if input.pressed(KeyCode::W) {
            direction.z -= 1.0;
        }
        if input.pressed(KeyCode::S) {
            direction.z += 1.0;
        }
        if input.pressed(KeyCode::A) {
            direction.x -= 1.0;
        }
        if input.pressed(KeyCode::D) {
            direction.x += 1.0;
        }

        direction = transform.rotation * direction * control.speed;
        transform.translation += direction;
        
        info!("First Person: Moved camera. Direction: {:?}, New position: {:?}", direction, transform.translation);
    }
}

pub fn fly_control_system(
    mut query: Query<(&mut Transform, &FlyControlComponent)>,
    input: Res<Input<KeyCode>>,
    mut mouse_motion_events: EventReader<MouseMotion>,
) {
    for (mut transform, control) in query.iter_mut() {
        for event in mouse_motion_events.read() {
            let delta_yaw = event.delta.x * control.sensitivity;
            let delta_pitch = event.delta.y * control.sensitivity;

            transform.rotation = transform.rotation * Quat::from_rotation_y(delta_yaw);
            transform.rotation = transform.rotation * Quat::from_rotation_x(delta_pitch);
            
            info!("Fly Control: Rotated camera. Yaw: {}, Pitch: {}", delta_yaw, delta_pitch);
        }

        let mut direction = Vec3::ZERO;

        if input.pressed(KeyCode::W) {
            direction.z -= 1.0;
        }
        if input.pressed(KeyCode::S) {
            direction.z += 1.0;
        }
        if input.pressed(KeyCode::A) {
            direction.x -= 1.0;
        }
        if input.pressed(KeyCode::D) {
            direction.x += 1.0;
        }
        if input.pressed(KeyCode::Space) {
            direction.y += 1.0;
        }
        // if input.pressed(KeyCode::LShift) {
        //     direction.y -= 1.0;
        // }

        direction = transform.rotation * direction * control.speed;
        transform.translation += direction;
        
        info!("Fly Control: Moved camera. Direction: {:?}, New position: {:?}", direction, transform.translation);
    }
}

pub fn globe_control_system(
    mut query: Query<(&mut Transform, &GlobeControlComponent)>,
    mut mouse_motion_events: EventReader<MouseMotion>,
    mut mouse_wheel_events: EventReader<MouseWheel>,
    keyboard_input: Res<Input<KeyCode>>,
    mouse_input: Res<Input<MouseButton>>,
) {
    for (mut transform, control) in query.iter_mut() {
        // Handle track (left-right and up-down movement)
        if mouse_input.pressed(MouseButton::Left) {
            for event in mouse_motion_events.read() {
                let delta_x = event.delta.x * control.sensitivity;
                let delta_y = event.delta.y * control.sensitivity;

                // Adjust transform translation based on mouse movement
                transform.translation.x += delta_x;
                transform.translation.y += delta_y;
                
                info!("Globe Control: Tracked camera. Delta X: {}, Delta Y: {}", delta_x, delta_y);
            }
        }

        // Handle dolly (zoom in and out)
        for event in mouse_wheel_events.read() {
            let delta = event.y * control.sensitivity;

            // Adjust transform translation based on scroll wheel
            transform.translation.z += delta;
            
            info!("Globe Control: Dollied camera. Delta Z: {}", delta);
        }

        // Handle rotation (left-right and up-down rotation)
        if mouse_input.pressed(MouseButton::Right) {
            for event in mouse_motion_events.read() {
                let delta_yaw = event.delta.x * control.sensitivity;
                let delta_pitch = event.delta.y * control.sensitivity;

                transform.rotation = transform.rotation * Quat::from_rotation_y(delta_yaw);
                transform.rotation = transform.rotation * Quat::from_rotation_x(delta_pitch);
                
                info!("Globe Control: Rotated camera. Yaw: {}, Pitch: {}", delta_yaw, delta_pitch);
            }
        }
    }
}

pub fn planar_control_system(
    mut query: Query<(&mut Transform, &PlanarControlComponent)>,
    mut mouse_motion_events: EventReader<MouseMotion>,
    keyboard_input: Res<Input<KeyCode>>,
    mouse_input: Res<Input<MouseButton>>,
) {
    for (mut transform, control) in query.iter_mut() {
        // Handle panning
        if mouse_input.pressed(MouseButton::Left) {
            for event in mouse_motion_events.read() {
                let delta_x = event.delta.x * control.sensitivity;
                let delta_y = event.delta.y * control.sensitivity;

                // Adjust transform translation based on mouse movement
                transform.translation.x += delta_x;
                transform.translation.y += delta_y;
                
                info!("Planar Control: Panned camera. Delta X: {}, Delta Y: {}", delta_x, delta_y);
            }
        }

        // Handle tilt (up-down rotation)
        if keyboard_input.pressed(KeyCode::ControlLeft) || keyboard_input.pressed(KeyCode::ControlRight) {
            for event in mouse_motion_events.read() {
                let delta_pitch = event.delta.y * control.sensitivity;
                transform.rotation = transform.rotation * Quat::from_rotation_x(delta_pitch);
                
                info!("Planar Control: Tilted camera. Pitch: {}", delta_pitch);
            }
        }
    }
}

pub fn street_control_system(
    mut query: Query<(&mut Transform, &StreetControlComponent)>,
    keyboard_input: Res<Input<KeyCode>>,
    mut mouse_motion_events: EventReader<MouseMotion>,
) {
    for (mut transform, control) in query.iter_mut() {
        for event in mouse_motion_events.read() {
            let delta_yaw = event.delta.x * control.sensitivity;
            let delta_pitch = event.delta.y * control.sensitivity;

            transform.rotation = transform.rotation * Quat::from_rotation_y(delta_yaw);
            transform.rotation = transform.rotation * Quat::from_rotation_x(delta_pitch);
            
            info!("Street Control: Rotated camera. Yaw: {}, Pitch: {}", delta_yaw, delta_pitch);
        }

        let mut direction = Vec3::ZERO;

        if keyboard_input.pressed(KeyCode::W) {
            direction.z -= 1.0;
        }
        if keyboard_input.pressed(KeyCode::S) {
            direction.z += 1.0;
        }
        if keyboard_input.pressed(KeyCode::A) {
            direction.x -= 1.0;
        }
        if keyboard_input.pressed(KeyCode::D) {
            direction.x += 1.0;
        }

        direction = transform.rotation * direction * control.speed;
        transform.translation += direction;
        
        info!("Street Control: Moved camera. Direction: {:?}, New position: {:?}", direction, transform.translation);
    }
}

pub fn dolly_control_system(
    mut query: Query<(&mut Transform, &DollyControlComponent)>,
    mut mouse_wheel_events: EventReader<MouseWheel>,
) {
    for (mut transform, control) in query.iter_mut() {
        for event in mouse_wheel_events.read() {
            let delta = event.y * control.sensitivity;

            // Adjust transform translation based on scroll wheel
            transform.translation.z += delta;
            
            info!("Dolly Control: Dollied camera. Delta Z: {}", delta);
        }
    }
}

pub fn track_control_system(
    mut query: Query<(&mut Transform, &TrackControlComponent)>,
    mut mouse_motion_events: EventReader<MouseMotion>,
    mouse_input: Res<Input<MouseButton>>,
) {
    for (mut transform, control) in query.iter_mut() {
        if mouse_input.pressed(MouseButton::Left) {
            for event in mouse_motion_events.read() {
                let delta_x = event.delta.x * control.sensitivity;
                let delta_y = event.delta.y * control.sensitivity;

                transform.translation.x += delta_x;
                transform.translation.y += delta_y;
                
                info!("Track Control: Tracked camera. Delta X: {}, Delta Y: {}", delta_x, delta_y);
            }
        }
    }
}

pub fn pan_tilt_control_system(
    mut query: Query<(&mut Transform, &PanTiltControlComponent)>,
    mut mouse_motion_events: EventReader<MouseMotion>,
    mouse_input: Res<Input<MouseButton>>,
) {
    for (mut transform, control) in query.iter_mut() {
        if mouse_input.pressed(MouseButton::Right) {
            for event in mouse_motion_events.read() {
                let delta_pan = event.delta.x * control.pan_sensitivity;
                let delta_tilt = event.delta.y * control.tilt_sensitivity;

                transform.rotation = transform.rotation * Quat::from_rotation_y(delta_pan);
                transform.rotation = transform.rotation * Quat::from_rotation_x(delta_tilt);
                
                info!("Pan-Tilt Control: Rotated camera. Pan: {}, Tilt: {}", delta_pan, delta_tilt);
            }
        }
    }
}

pub fn inertia_control_system(
    mut query: Query<(&mut Transform, &InertiaControlComponent)>,
    time: Res<Time>,
) {
    for (mut transform, control) in query.iter_mut() {
        let delta_time = time.delta_seconds();

        let old_translation = transform.translation;
        let old_rotation = transform.rotation;

        transform.translation *= control.inertia.powf(delta_time);
        transform.rotation = transform.rotation.slerp(Quat::IDENTITY, 1.0 - control.inertia.powf(delta_time));
        
        info!("Inertia Control: Applied inertia. Translation change: {:?}, Rotation change: {:?}", 
              transform.translation - old_translation, 
              transform.rotation * old_rotation.inverse());
    }
}

pub fn update_frustum_system(
    mut query: Query<(&Transform, &mut CameraFrustum)>,
) {
    for (transform, mut frustum) in query.iter_mut() {
        frustum.update_sse_denominator();
        frustum.update_planes(transform);
        
        info!("Updated camera frustum. Transform: {:?}", transform);
    }
}