use navara_event_store::EventStore;

use navara_math::Transform;
use navara_window::WindowResizeEvent;

use crate::{CameraEvent, CameraFrustum};

use super::CameraMarker;
use bevy_app::{PostUpdate, Startup, Update};
use bevy_ecs::{
    entity::Entity,
    event::EventReader,
    query::{Added, Changed, Or},
    schedule::IntoSystemConfigs,
    system::{Query, ResMut},
};

#[derive(Debug)]
pub struct CameraPlugin;

impl bevy_app::Plugin for CameraPlugin {
    fn build(&self, app: &mut bevy_app::App) {
        app.add_systems(Startup, super::system::startup)
            .add_event::<CameraEvent>()
            .add_systems(
                Update,
                (
                    handle_resize,
                    (super::system::update, super::system::update_frustum).chain(),
                ),
            )
            .add_systems(PostUpdate, commit);
    }
}

// fn startup(mut commands: Commands) {
//     let translation = Vec3::new(-1000.0, 0.0, 0.0);
//     commands.spawn(CameraBundle {
//         marker: CameraMerker,
//         transform: Transform::from_translation(translation),
//     });
// }

#[allow(clippy::type_complexity)]
fn commit(
    mut events: ResMut<EventStore>,
    query: Query<(Entity, &CameraMarker), Or<(Added<Transform>, Changed<Transform>)>>,
) {
    let Some((e, _)) = query.iter().last() else {
        return;
    };
    events.camera_transform_updated = Some(e);
}

fn handle_resize(
    mut camera: Query<(&CameraMarker, &mut CameraFrustum)>,
    mut ev: EventReader<WindowResizeEvent>,
) {
    for w in ev.read() {
        for (_, mut frustum) in &mut camera {
            frustum.aspect_ratio = w.width / w.height;
            frustum.update_sse_denominator();
        }
    }
}
