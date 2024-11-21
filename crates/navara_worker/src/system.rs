use bevy_ecs::{
    entity::Entity,
    query::With,
    system::{Commands, Query},
};
use navara_component::Deleted;

use crate::component::WorkerTaskMarker;

pub fn remove(
    mut commands: Commands,
    constructors: Query<Entity, (With<Deleted>, With<WorkerTaskMarker>)>,
) {
    for e in &constructors {
        commands.entity(e).despawn();
    }
}
