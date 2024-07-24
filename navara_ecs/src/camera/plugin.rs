use bevy_app::prelude::*;
use bevy_ecs::prelude::*;
use bevy_log::info;
use bevy_math::Quat;
use bevy_math::Vec3;
use navara_core::Angle;

use super::comp::*;
use super::system::*;

use crate::event::EventStore;
use crate::Transform;

pub struct CameraPlugin;

impl Plugin for CameraPlugin {
    fn build(&self, app: &mut App) {
        app.add_systems(Startup, setup_camera);
        app.add_systems(
            Update,
            (
                (
                    first_person_control_system,
                    // fly_control_system,
                    // globe_control_system,
                    // planar_control_system,
                    // street_control_system,
                    // dolly_control_system,
                    // track_control_system,
                    // pan_tilt_control_system,
                ),
                update_frustum_system,
            )
                .chain(),
        )
        .add_systems(PostUpdate, commit);
    }
}

fn setup_camera(mut commands: Commands) {
    let earth_radius = 6371000.0;
    let translation = Vec3::ZERO;
    let transform = Transform::from_translation(translation);
    commands.spawn((
        CameraMarker,
        Orbit {
            r: earth_radius * 3.,
            quat: Quat::from_axis_angle(Vec3::Y, 0.0),
            tilt: 0.0,
        },
        GlobeControlComponent {
            sensitivity: 0.5,
            speed: 10.0,
        },
        DollyControlComponent { sensitivity: 0.1 },
        TrackControlComponent { sensitivity: 0.1 },
        PanTiltControlComponent {
            pan_sensitivity: 0.1,
            tilt_sensitivity: 0.1,
        },
        CameraFrustum::new(&transform, 0.1, 1e8, Angle::new(50.).rad().val(), 1.)
        ,
        transform,
    ));
}

fn commit(
    mut events: ResMut<EventStore>,
    query: Query<(Entity, &CameraMarker), Changed<Transform>>,
) {
    if let Some((entity, _)) = query.iter().next() {
        events.camera_transform_updated = Some(entity);
        info!("Camera transform updated for entity: {:?}", entity);
    }
}
