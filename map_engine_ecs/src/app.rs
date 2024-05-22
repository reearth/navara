use bevy_app::prelude::*;
use bevy_ecs::system::Commands;
use bevy_time::TimePlugin;

pub struct Plugin;

impl bevy_app::Plugin for Plugin {
    fn build(&self, app: &mut App) {
        // bevy plugins
        app.add_plugins(bevy_log::LogPlugin::default());
        app.add_plugins(TimePlugin);

        // custom plugins
        app.add_plugins(super::buffer::BufferStorePlugin);
        app.add_plugins(super::texture_fragment::TextureFragmentPlugin);
        app.add_plugins(super::input::InputPlugin);
        app.add_plugins(super::event::EventPlugin);
        app.add_plugins(super::object::ObjectPlugin);
        app.add_plugins(super::camera::CameraPlugin);
        app.add_plugins(super::map::MapPlugin);

        // custom systems
        app.add_systems(Startup, startup);
        app.add_systems(Update, update);
    }
}

fn startup(mut _commands: Commands) {
    // TODO
}

fn update() {
    // TODO
}
