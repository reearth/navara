use bevy_ecs::system::{Commands, Query};

use navara_component::{OrderByDistance, Priority};
use navara_core::tile_url;
use navara_layer::TilesLayer;
use navara_texture_fragment::TextureFragment;
use navara_tile_component::{
    RasterTile, TileHandle, TileTextureFragmentMarker, TileTextureFragmentQuery,
};

pub(crate) fn request_texture_fragment(
    commands: &mut Commands,
    leaf: &mut RasterTile,
    tiles: &Query<&TilesLayer>,
    handle: TileHandle,
    texture_fragment: &TileTextureFragmentQuery,
    priority: Priority,
) {
    let tiles_len = tiles.iter().len();
    if matches!(leaf.texture_fragment_entity_ids.as_ref(), Some(e) if e.len() == tiles_len && e.iter().all(|e| e.is_some_and(|e| texture_fragment.contains(e))))
    {
        return;
    }

    // Wait until previous request is ready.
    if let Some(Some(e)) = leaf
        .texture_fragment_entity_ids
        .as_ref()
        .and_then(|ids| ids.last())
    {
        if texture_fragment.get(*e).map_or(false, |t| t.1.is_pending()) {
            return;
        }
    }

    let idx = leaf
        .texture_fragment_entity_ids
        .as_ref()
        .map_or(0, |ids| ids.len());
    let Some(mut next_tile) = tiles.iter().nth(idx) else {
        return;
    };

    if next_tile.is_over_z(leaf.coords.z) {
        leaf.texture_fragment_entity_ids
            .get_or_insert_with(|| Vec::with_capacity(tiles_len))
            .push(None);
        if let Some(next) = tiles.iter().nth(idx + 1) {
            next_tile = next;
        };
    }

    let url = tile_url(next_tile.data.as_ref().unwrap().url.as_str(), &leaf.coords);
    let entity = commands.spawn((
        TileTextureFragmentMarker(handle),
        TextureFragment::new(url),
        OrderByDistance {
            sse: leaf.sse,
            distance: leaf.distance_from_camera,
        },
        priority,
    ));
    let id = entity.id();

    leaf.texture_fragment_entity_ids
        .get_or_insert_with(|| Vec::with_capacity(tiles_len))
        .push(Some(id));
}
