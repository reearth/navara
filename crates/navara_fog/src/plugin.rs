use bevy_app::Startup;

#[derive(Debug)]
pub struct FogPlugin;

impl bevy_app::Plugin for FogPlugin {
    fn build(&self, app: &mut bevy_app::App) {
        app.add_systems(Startup, super::system::startup);
    }
}
