use bevy_ecs::component::Component;

use crate::tile::TileHandle;

#[derive(Component)]
pub struct TerrainDataRequesterMarker(pub TileHandle);
