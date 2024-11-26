use crate::{tile::render::TileOrderByDistance, TileQuadtree};
use bevy_ecs::{entity::Entity, system::Commands};
use navara_core::tile_url;
use navara_layer::TilesLayer;
use navara_math::FloatType;
use navara_texture_fragment::TextureFragment;
use navara_tile_component::{TileHandle, TileTextureFragmentMarker, TileTextureFragmentQuery};

pub(crate) fn request_texture_fragment(
    commands: &mut Commands,
    qt: &mut TileQuadtree,
    tiles: &TilesLayer,
    handle: TileHandle,
    tile_distance: FloatType,
    texture_fragment: &TileTextureFragmentQuery,
) -> Option<Entity> {
    let tile = qt.qt.get_mut(handle).unwrap();
    if matches!(tile.texture_fragment_entity_id, Some(e) if texture_fragment.contains(e)) {
        return None;
    }

    let url = tile_url(tiles.data.as_ref().unwrap().url.as_str(), &tile.coords);
    let entity = commands.spawn((
        TileTextureFragmentMarker(handle),
        TextureFragment::new(url),
        TileOrderByDistance(tile_distance),
    ));
    let id = entity.id();
    tile.texture_fragment_entity_id = Some(id);

    Some(id)
}
