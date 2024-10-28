use bevy_app::{App, Plugin, Update};

mod requester;
mod system;

pub struct MvtPlugin;

impl Plugin for MvtPlugin {
    fn build(&self, app: &mut App) {
        app.add_systems(Update, (system::request_mvt, system::construct_mvt));
    }
}
