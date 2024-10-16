use bevy_app::{App, Plugin, Update};

mod requester;
mod system;

pub struct B3dmPlugin;

impl Plugin for B3dmPlugin {
    fn build(&self, app: &mut App) {
        app.add_systems(Update, (system::request_model, system::construct_model));
    }
}
