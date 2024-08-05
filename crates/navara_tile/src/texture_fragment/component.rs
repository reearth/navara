use bevy_ecs::component::Component;

use crate::tile::TileHandle;

#[derive(Component)]
pub struct TileTextureFragmentMarker(pub TileHandle);
