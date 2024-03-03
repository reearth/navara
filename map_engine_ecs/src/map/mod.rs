use bevy_app::{App, Plugin, Startup};
use bevy_ecs::system::Commands;

pub struct MapPlugin;

impl Plugin for MapPlugin {
    fn build(&self, app: &mut App) {
        app.add_systems(Startup, setup);
    }
}

fn setup(mut _commands: Commands) {
    // commands.spawn_bundle(OrthographicCameraBundle::new_2d());
}
