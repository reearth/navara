use bevy_ecs::system::Commands;

use crate::Fog;

// TODO: Add a system to update Fog values by user.
// These are just fixed vales for LOD calculation. You need to set a fog in rendering engine side if necessary.
pub fn startup(mut commands: Commands) {
    commands.spawn(Fog {
        enabled: true,
        density: 2.0e-4,
        sse_factor: 2.0,
    });
}
