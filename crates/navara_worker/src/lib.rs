mod component;
mod delegated_task;
mod event;
mod system;
mod tasks;

use bevy_app::Update;
use bevy_ecs::schedule::IntoSystemConfigs;
pub use component::*;
pub use delegated_task::*;
pub use event::*;
pub use tasks::*;

pub struct WorkerPlugin;

impl bevy_app::Plugin for WorkerPlugin {
    fn build(&self, app: &mut bevy_app::App) {
        app.add_event::<WorkerTaskCompletedEvent>().add_systems(
            Update,
            (
                system::remove,
                tasks::construct_terrain_mesh::system::construct_terrain_mesh,
                tasks::upsample_terrain_mesh::system::upsample_terrain_mesh,
                system::handle_completed_event,
                system::commit,
                system::remove_relation,
            )
                .chain(),
        );
    }
}
