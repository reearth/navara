use bevy_ecs::{component::Component, query::Without, system::Query};
use navara_component::Deleted;
use navara_texture_fragment::TextureFragment;

use crate::tile::TileHandle;

#[derive(Component)]
pub struct TileTextureFragmentMarker(pub TileHandle);

pub type TileTextureFragmentQuery<'world, 'state, 'a> =
    Query<'world, 'state, (&'a TileTextureFragmentMarker, &'a TextureFragment), Without<Deleted>>;
