use bevy_app::{Startup, Update};

use crate::{DynamicSseConfig, LodFogConfig};

#[derive(Debug)]
pub struct FogPlugin;

impl bevy_app::Plugin for FogPlugin {
    fn build(&self, app: &mut bevy_app::App) {
        app.init_resource::<LodFogConfig>();
        app.init_resource::<DynamicSseConfig>();
        app.add_systems(Startup, super::system::startup);
        app.add_systems(
            Update,
            (
                super::system::apply_lod_fog_config,
                super::system::apply_dynamic_sse_config,
            ),
        );
    }
}
