use crate::{
    tile::{render::TileOrderByDistance, TileHandle},
    TileQuadtree,
};
use bevy_ecs::system::Commands;
use navara_core::tile_url;
use navara_layer::TilesLayer;
use navara_math::FloatType;
use navara_texture_fragment::TextureFragment;

use super::TileTextureFragmentMarker;

pub(crate) fn request_texture_fragment(
    commands: &mut Commands,
    qt: &mut TileQuadtree,
    tiles: &TilesLayer,
    handle: TileHandle,
    tile_distance: FloatType,
) -> bool {
    let tile = qt.qt.get_mut(handle).unwrap();
    if tile.texture_fragment_entity_id.is_some() {
        return false;
    }

    let url = tile_url(&tiles.url, &tile.coords);
    let entity = commands.spawn((
        TileTextureFragmentMarker(handle),
        TextureFragment::new(url),
        TileOrderByDistance(tile_distance),
    ));
    tile.texture_fragment_entity_id = Some(entity.id());

    true
}
