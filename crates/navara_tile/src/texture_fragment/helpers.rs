use bevy_ecs::system::{Commands, Query};

use navara_component::{Ignored, Order, OrderByDistance, Priority};
use navara_core::tile_url;
use navara_layer::TilesLayer;
use navara_material::Appearance;
use navara_texture_fragment::{TextureFragment, TextureFragmentStatus};
use navara_tile_component::{
    RasterTile, TileHandle, TileTextureFragmentMarker, TileTextureFragmentQuery,
};

pub(crate) fn request_texture_fragment(
    commands: &mut Commands,
    leaf: &mut RasterTile,
    tiles: &Query<(&TilesLayer, &Order)>,
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
        && texture_fragment.get(*e).is_ok_and(|t| t.1.is_pending())
    {
        return;
    }

    let idx = leaf
        .texture_fragment_entity_ids
        .as_ref()
        .map_or(0, |ids| ids.len());

    // Skip requesting a tile that doesn't match `min_zoom` and `max_zoom` conditions,
    // since selected tile has multiple layers.
    for (next, _) in tiles.iter().skip(idx) {
        let tms = matches!(next.appearance.as_ref(), Some(Appearance::RasterTile(m)) if m.tms);
        let url = tile_url(next.data.as_ref().unwrap().url.as_str(), &leaf.coords, tms);

        // The number of `texture_fragment_entity_ids` and layers need to match to render correctly,
        // but we can avoid requesting the resource beyond the max zoom level.
        let skip_request =
            next.is_over_max_zoom(leaf.coords.z) || !next.is_over_min_zoom(leaf.coords.z);

        let mut entity = commands.spawn((
            TileTextureFragmentMarker(handle),
            TextureFragment::with_status(
                url,
                if skip_request {
                    TextureFragmentStatus::Fail
                } else {
                    TextureFragmentStatus::Pending
                },
            ),
            OrderByDistance {
                sse: leaf.sse,
                distance: leaf.distance_from_camera,
            },
            priority,
        ));

        if skip_request {
            entity.insert(Ignored);
        }

        let id = entity.id();

        leaf.texture_fragment_entity_ids
            .get_or_insert_with(|| Vec::with_capacity(tiles_len))
            .push(Some(id));
    }
}
