use bevy_ecs::system::{Commands, Query};
use url::Url;

use navara_buffer_store::BufferStore;
use navara_component::{Order, OrderByDistance, Priority};
use navara_core::tile_url;
use navara_data_requester::{DataRequester, DataRequesterExtension};
use navara_layer::TilesLayer;
use navara_material::Appearance;
use navara_texture_fragment::TextureFragment;
use navara_tile_component::{
    RasterTile, TileHandle, TileTextureFragmentMarker, TileTextureFragmentQuery,
};

use crate::hillshade::HillshadeTextureMarker;

#[allow(clippy::too_many_arguments)]
pub(crate) fn request_texture_fragment(
    commands: &mut Commands,
    leaf: &mut RasterTile,
    tiles: &Query<(&TilesLayer, &Order)>,
    handle: TileHandle,
    texture_fragment: &TileTextureFragmentQuery,
    data_requesters: &Query<&DataRequester>,
    priority: Priority,
    buf: &mut BufferStore,
) {
    let sorted_tiles: Vec<_> = tiles.iter().sort::<&Order>().collect();
    let tiles_len = sorted_tiles.len();
    if tiles_len == 0 {
        return;
    }

    let coords = leaf.coords;
    let sse = leaf.sse;
    let distance_from_camera = leaf.distance_from_camera;

    // Both arrays stay at `tiles_len` for the lifetime of the tile. Filter systems
    // clear rejected slots to None (rather than removing) so the layer-index
    // alignment is preserved across frames.
    leaf.texture_fragment_entity_ids
        .get_or_insert_with(|| vec![None; tiles_len]);
    leaf.hillshade_entity_ids
        .get_or_insert_with(|| vec![None; tiles_len]);

    // Check whether every layer is already handled.
    // Out-of-zoom layers stay None; regular layers must have a queryable
    // TextureFragment entity; hillshade layers must have a queryable DataRequester.
    let all_layers_requested = {
        let tex_ids = leaf.texture_fragment_entity_ids.as_ref().unwrap();
        let hill_ids = leaf.hillshade_entity_ids.as_ref().unwrap();
        sorted_tiles.iter().enumerate().all(|(i, (layer, _))| {
            if !layer.is_over_min_zoom(coords.z) || layer.is_over_max_zoom(coords.z) {
                return true;
            }
            if layer.hillshade_config.is_some() {
                hill_ids[i].is_some_and(|e| data_requesters.get(e).is_ok())
            } else {
                tex_ids[i].is_some_and(|e| texture_fragment.contains(e))
            }
        })
    };
    if all_layers_requested {
        return;
    }

    for (i, (layer, _)) in sorted_tiles.iter().enumerate() {
        // Skip layers whose zoom range excludes this tile. The slot stays None.
        if !layer.is_over_min_zoom(coords.z) || layer.is_over_max_zoom(coords.z) {
            continue;
        }
        let is_hillshade = layer.hillshade_config.is_some();

        // Skip layers that already have a valid in-flight or completed entity.
        let already_requested = {
            let tex_ids = leaf.texture_fragment_entity_ids.as_ref().unwrap();
            let hill_ids = leaf.hillshade_entity_ids.as_ref().unwrap();
            if is_hillshade {
                hill_ids[i].is_some_and(|e| data_requesters.get(e).is_ok())
            } else {
                tex_ids[i].is_some_and(|e| texture_fragment.contains(e))
            }
        };
        if already_requested {
            continue;
        }

        let tms = matches!(layer.appearance.as_ref(), Some(Appearance::RasterTile(m)) if m.tms);
        let url = tile_url(layer.data.as_ref().unwrap().url.as_str(), &coords, tms);

        let entity_id = if is_hillshade {
            // Hillshade texture: use DataRequester so Rust can backfill edges.
            let extension = Url::parse(&url)
                .ok()
                .map(|parsed_url| DataRequesterExtension::from_url(&parsed_url))
                .unwrap_or(DataRequesterExtension::Png); // Fallback to PNG if URL parsing fails

            commands
                .spawn((
                    TileTextureFragmentMarker(handle),
                    HillshadeTextureMarker,
                    DataRequester::from_store(url, buf, extension),
                    OrderByDistance {
                        sse,
                        distance: distance_from_camera,
                    },
                    priority,
                ))
                .id()
        } else {
            commands
                .spawn((
                    TileTextureFragmentMarker(handle),
                    TextureFragment::new(url),
                    OrderByDistance {
                        sse,
                        distance: distance_from_camera,
                    },
                    priority,
                ))
                .id()
        };

        if is_hillshade {
            leaf.hillshade_entity_ids.as_mut().unwrap()[i] = Some(entity_id);
        } else {
            leaf.texture_fragment_entity_ids.as_mut().unwrap()[i] = Some(entity_id);
        }
    }
}
