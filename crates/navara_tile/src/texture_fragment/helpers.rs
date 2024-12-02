use bevy_ecs::{entity::Entity, system::Commands};
use navara_component::{OrderByDistance, Priority};
use navara_core::tile_url;
use navara_layer::TilesLayer;
use navara_texture_fragment::TextureFragment;
use navara_tile_component::{
    Tile, TileHandle, TileTextureFragmentMarker, TileTextureFragmentQuery,
};

pub(crate) fn request_texture_fragment(
    commands: &mut Commands,
    tile: &mut Tile,
    tiles: &TilesLayer,
    handle: TileHandle,
    texture_fragment: &TileTextureFragmentQuery,
    priority: Priority,
) -> Option<Entity> {
    if matches!(tile.texture_fragment_entity_id, Some(e) if texture_fragment.contains(e)) {
        return None;
    }

    let url = tile_url(tiles.data.as_ref().unwrap().url.as_str(), &tile.coords);
    let entity = commands.spawn((
        TileTextureFragmentMarker(handle),
        TextureFragment::new(url),
        OrderByDistance(tile.distance_from_camera),
        priority,
    ));
    let id = entity.id();
    tile.texture_fragment_entity_id = Some(id);

    Some(id)
}
