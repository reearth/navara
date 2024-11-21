use bevy_ecs::component::Component;

use crate::TileHandle;

#[derive(Debug, Default, Component)]
pub struct TileMeshMarker(pub TileHandle);
