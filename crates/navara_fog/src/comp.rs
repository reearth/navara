use bevy_ecs::component::Component;
use bevy_ecs::resource::Resource;
use navara_math::FloatType;

#[derive(Component, Clone)]
pub struct Fog {
    pub enabled: bool,
    pub density: FloatType,
    pub sse_factor: FloatType,
}

impl Fog {
    /// Inert fog used as a fallback when no [`Fog`] entity exists yet.
    pub fn disabled() -> Self {
        Self {
            enabled: false,
            density: 0.,
            sse_factor: 0.,
        }
    }
}

/// Buffered LOD fog parameters, written by `Core.setLodFog` (via
/// `App::set_lod_fog`) and applied to the [`Fog`] entity. `init_resource`'d at
/// plugin build so a `setLodFog` call that arrives BEFORE the first
/// `App::update()` — i.e. before the `Startup` system has spawned the `Fog`
/// entity — is not dropped: the value is stored here and the startup spawn reads
/// it, and later calls are applied to the live entity by a change-detection
/// system. Mirrors how `set_sse_multiplier_range` / `set_cache_bytes` buffer
/// into `MemoryLedger`.
#[derive(Resource, Clone)]
pub struct LodFogConfig {
    pub enabled: bool,
    pub density: FloatType,
    pub sse_factor: FloatType,
}

impl Default for LodFogConfig {
    fn default() -> Self {
        // Same defaults the original `Startup` spawn used.
        Self {
            enabled: true,
            density: 2.0e-4,
            sse_factor: 2.0,
        }
    }
}
