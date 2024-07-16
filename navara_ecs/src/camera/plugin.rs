use bevy_app::prelude::*;
use bevy_input::InputPlugin;
use bevy_math::Vec3;
use bevy_time::TimePlugin;
use bevy_log::LogPlugin;
use bevy_ecs::prelude::*;

use super::system::*;
use super::comp::*;

use crate::Transform;

pub struct CameraPlugin;

impl Plugin for CameraPlugin {
    fn build(&self, app: &mut App) {
        app.add_plugins(LogPlugin::default());
        app.add_plugins(TimePlugin);
        app.add_plugins(InputPlugin);

        app.add_systems(Startup, setup_camera);
        app.add_systems( Update, ((
        (first_person_control_system),
        (fly_control_system),
        (globe_control_system),
        (planar_control_system),
        (street_control_system),
        (dolly_control_system),
        (track_control_system),
        (pan_tilt_control_system),
        (inertia_control_system), 
        ), update_frustum_system).chain(),
         );
    }
}

fn setup_camera(mut commands: Commands) {
    let earth_radius = 6371000.0;
    let translation = Vec3::ZERO;
    commands.spawn((
        CameraMarker,
        GlobeControlComponent {
            sensitivity: 0.5,
            speed: 10.0,
        },
        DollyControlComponent {
            sensitivity: 0.1,
        },
        TrackControlComponent {
            sensitivity: 0.1,
        },
        PanTiltControlComponent {
            pan_sensitivity: 0.1,
            tilt_sensitivity: 0.1,
        },
        InertiaControlComponent {
            inertia: 0.9,
        },
        CameraFrustum::new(&Transform::from_translation(translation), 0.1, 1000.0, 45.0, 1.77),
        Transform::from_translation(translation),
    ));
}
