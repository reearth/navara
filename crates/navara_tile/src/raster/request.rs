use bevy_ecs::system::Commands;

use navara_component::{Order, OrderByDistance, Priority};
use navara_core::TilingScheme;
use navara_layer::TilesLayer;
use navara_texture_fragment::TextureFragment;
use navara_tile_component::{
    RasterTile, TileHandle, TileTextureFragmentMarker, TileTextureFragmentQuery,
};

/// Request texture fragments for a raster tile, one per regular (non-hillshade)
/// layer. Hillshade layers are handled on the terrain side and skipped here.
///
/// Raster tiles always live in a WebMercator quadtree, so the tile URL is built
/// directly from the tile's own coordinates.
/// `sorted_tiles` is the layer list sorted by `Order`, collected once per system
/// run (this helper is called per raster tile).
#[allow(clippy::too_many_arguments)]
pub(crate) fn request_raster_texture_fragment(
    commands: &mut Commands,
    leaf: &mut RasterTile,
    sorted_tiles: &[(&TilesLayer, &Order)],
    source_store: &navara_source::SourceStore,
    handle: TileHandle,
    texture_fragment: &TileTextureFragmentQuery,
    priority: Priority,
) {
    let tiles_len = sorted_tiles.len();
    if tiles_len == 0 {
        return;
    }

    let coords = leaf.coords;
    let sse = leaf.sse;
    let distance_from_camera = leaf.distance_from_camera;

    // Slots stay aligned with the full sorted layer list (regular + hillshade);
    // hillshade slots are left None here and resolved on the terrain side.
    let tex_ids = leaf
        .texture_fragment_entity_ids
        .get_or_insert_with(|| vec![None; tiles_len]);
    if tex_ids.len() < tiles_len {
        tex_ids.resize(tiles_len, None);
    }

    // Every regular in-zoom layer already has a queryable TextureFragment?
    let all_layers_requested = {
        let tex_ids = leaf.texture_fragment_entity_ids.as_ref().unwrap();
        sorted_tiles.iter().enumerate().all(|(i, (layer, _))| {
            if layer.hillshade_config.is_some() {
                return true;
            }
            let Some(source) = layer
                .source_id
                .as_deref()
                .and_then(|id| source_store.get(id))
            else {
                return true;
            };
            if !source.is_over_min_zoom(coords.z) || source.is_over_max_zoom(coords.z) {
                return true;
            }
            tex_ids[i].is_some_and(|e| texture_fragment.contains(e))
        })
    };
    if all_layers_requested {
        return;
    }

    for (i, (layer, _)) in sorted_tiles.iter().enumerate() {
        // Hillshade is resolved on the terrain side.
        if layer.hillshade_config.is_some() {
            continue;
        }
        // Resolve the referenced source; skip the layer if it is missing.
        let Some(source) = layer
            .source_id
            .as_deref()
            .and_then(|id| source_store.get(id))
        else {
            continue;
        };
        // Skip layers whose zoom range excludes this tile. The slot stays None.
        if !source.is_over_min_zoom(coords.z) || source.is_over_max_zoom(coords.z) {
            continue;
        }

        let already_requested = {
            let tex_ids = leaf.texture_fragment_entity_ids.as_ref().unwrap();
            tex_ids[i].is_some_and(|e| texture_fragment.contains(e))
        };
        if already_requested {
            continue;
        }

        let Some(url_template) = source.url() else {
            continue;
        };
        let url = TilingScheme::WebMercator { tms: source.tms() }.tile_url(url_template, coords);

        let entity_id = commands
            .spawn((
                TileTextureFragmentMarker(handle),
                TextureFragment::new(url),
                OrderByDistance {
                    sse,
                    distance: distance_from_camera,
                },
                priority,
            ))
            .id();

        leaf.texture_fragment_entity_ids.as_mut().unwrap()[i] = Some(entity_id);
    }
}
