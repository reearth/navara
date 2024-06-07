use super::super::event::EventStore;

use crate::Transform;

use super::CameraMarker;
use bevy_app::{PostUpdate, Startup, Update};
use bevy_ecs::{
    entity::Entity,
    query::Changed,
    schedule::IntoSystemConfigs,
    system::{Query, ResMut},
};

#[derive(Debug)]
pub struct CameraPlugin;

impl bevy_app::Plugin for CameraPlugin {
    fn build(&self, app: &mut bevy_app::App) {
        app.add_systems(Startup, super::system::startup)
            .add_systems(
                Update,
                (super::system::update, super::system::update_frustum).chain(),
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

fn commit(
    mut events: ResMut<EventStore>,
    query: Query<(Entity, &CameraMarker), Changed<Transform>>,
) {
    let Some((e, _)) = query.iter().next() else {
        return;
    };
    events.camera_transform_updated = Some(e);
}
