use bevy_ecs::change_detection::DetectChanges;
use bevy_ecs::system::{Commands, Query, Res};

use crate::{DynamicSse, DynamicSseConfig, Fog, LodFogConfig};

// These are LOD-calculation defaults, updatable from JS via `Core.setLodFog`
// (device-memory-based presets live in web/navara_three/src/device.ts). You
// need to set a fog in the rendering engine side if a visual fog is wanted.
//
// Seed the spawned `Fog` from `LodFogConfig` (not hardcoded defaults) so a
// `setLodFog` that landed before the first `App::update()` — before this
// `Startup` ran — is honored: the value was buffered into the resource.
pub fn startup(
    mut commands: Commands,
    config: Res<LodFogConfig>,
    dynamic_sse_config: Res<DynamicSseConfig>,
) {
    commands.spawn((
        Fog {
            enabled: config.enabled,
            density: config.density,
            sse_factor: config.sse_factor,
        },
        dynamic_sse_config.0.clone(),
    ));
}

/// Applies later `setLodFog` calls (which update [`LodFogConfig`]) to the live
/// `Fog` entity. Change-detected so it only writes when the config actually
/// changed. `App::set_lod_fog` also writes the entity directly when it exists,
/// so this covers the case where the config was set before the entity spawned.
pub fn apply_lod_fog_config(config: Res<LodFogConfig>, mut fogs: Query<&mut Fog>) {
    if !config.is_changed() {
        return;
    }
    for mut fog in fogs.iter_mut() {
        fog.enabled = config.enabled;
        fog.density = config.density;
        fog.sse_factor = config.sse_factor;
    }
}

/// Applies later `setDynamicSse` calls (which update [`DynamicSseConfig`]) to
/// the live [`DynamicSse`] component; mirrors [`apply_lod_fog_config`].
pub fn apply_dynamic_sse_config(
    config: Res<DynamicSseConfig>,
    mut dynamic_sses: Query<&mut DynamicSse>,
) {
    if !config.is_changed() {
        return;
    }
    for mut dynamic_sse in dynamic_sses.iter_mut() {
        *dynamic_sse = config.0.clone();
    }
}
