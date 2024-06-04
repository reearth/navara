use bevy_app::PreUpdate;

pub mod ellipsoidal_occluder;
mod system;

pub struct OccluderPlugin;

impl bevy_app::Plugin for OccluderPlugin {
    fn build(&self, app: &mut bevy_app::App) {
        app.add_systems(PreUpdate, system::startup)
            .add_systems(PreUpdate, system::update);
    }
}
