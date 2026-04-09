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
    let tiles_len = tiles.iter().len();

    // Check if all layers have entities (either in texture_fragment_entity_ids or hillshade_entity_ids)
    let all_layers_requested = leaf
        .texture_fragment_entity_ids
        .as_ref()
        .zip(leaf.hillshade_entity_ids.as_ref())
        .is_some_and(|(tex_ids, hill_ids)| {
            tex_ids.len() == tiles_len
                && hill_ids.len() == tiles_len
                && tex_ids
                    .iter()
                    .zip(hill_ids.iter())
                    .all(|(tex_opt, hill_opt)| {
                        // Check texture entity (TextureFragment only)
                        if let Some(tex_e) = tex_opt {
                            texture_fragment.contains(*tex_e)
                        }
                        // Check hillshade entity (DataRequester only)
                        else if let Some(hill_e) = hill_opt {
                            data_requesters.get(*hill_e).is_ok()
                        } else {
                            // Both None means this layer was skipped (for example due to
                            // min/max zoom), so there is nothing to request for this layer.
                            // This is treated as "already handled" for all_layers_requested,
                            // but it does not imply the tile is texture-ready in other checks.
                            true
                        }
                    })
        });

    if all_layers_requested {
        return;
    }

    // Wait until previous request is ready.
    // Check last texture fragment entity
    if let Some(Some(e)) = leaf
        .texture_fragment_entity_ids
        .as_ref()
        .and_then(|ids| ids.last())
        && (texture_fragment.get(*e).is_ok_and(|t| t.1.is_pending())
            || data_requesters.get(*e).is_ok_and(|r| r.is_pending()))
    {
        return;
    }
    // Check last hillshade entity
    if let Some(Some(e)) = leaf
        .hillshade_entity_ids
        .as_ref()
        .and_then(|ids| ids.last())
        && data_requesters.get(*e).is_ok_and(|r| r.is_pending())
    {
        return;
    }

    // Calculate idx as max length to handle case where hillshade is enabled after regular textures
    // This prevents misalignment when texture_fragment_entity_ids and hillshade_entity_ids have different lengths
    let tex_len = leaf
        .texture_fragment_entity_ids
        .as_ref()
        .map_or(0, |ids| ids.len());
    let hill_len = leaf
        .hillshade_entity_ids
        .as_ref()
        .map_or(0, |ids| ids.len());
    let idx = tex_len.max(hill_len);

    // Ensure both arrays have same length before processing by padding shorter one with None
    if tex_len < idx {
        let tex_ids = leaf
            .texture_fragment_entity_ids
            .get_or_insert_with(|| Vec::with_capacity(tiles_len));
        tex_ids.resize(idx, None);
    }
    if hill_len < idx {
        let hill_ids = leaf
            .hillshade_entity_ids
            .get_or_insert_with(|| Vec::with_capacity(tiles_len));
        hill_ids.resize(idx, None);
    }

    let mut next_tile = None;

    // Skip requesting a tile that doesn't match `min_zoom` and `max_zoom` conditions,
    // since selected tile has multiple layers.
    for (next, _) in tiles.iter().skip(idx) {
        if !next.is_over_min_zoom(leaf.coords.z) || next.is_over_max_zoom(leaf.coords.z) {
            // Push None to both arrays to maintain alignment
            leaf.texture_fragment_entity_ids
                .get_or_insert_with(|| Vec::with_capacity(tiles_len))
                .push(None);
            leaf.hillshade_entity_ids
                .get_or_insert_with(|| Vec::with_capacity(tiles_len))
                .push(None);
            next_tile = None;
        } else {
            next_tile = Some(next);
            break;
        }
    }

    let Some(next_tile) = next_tile else {
        return;
    };

    let tms = matches!(next_tile.appearance.as_ref(), Some(Appearance::RasterTile(m)) if m.tms);
    let url = tile_url(
        next_tile.data.as_ref().unwrap().url.as_str(),
        &leaf.coords,
        tms,
    );

    // Check if current layer is a hillshade texture (needs backfill)
    let is_hillshade = next_tile.hillshade_config.is_some();

    // Choose different path based on whether it's hillshade
    let entity = if is_hillshade {
        // Hillshade texture: use DataRequester (can backfill in Rust)
        // Use robust extension detection that handles query strings correctly
        let extension = Url::parse(&url)
            .ok()
            .map(|parsed_url| DataRequesterExtension::from_url(&parsed_url))
            .unwrap_or(DataRequesterExtension::Png); // Fallback to PNG if URL parsing fails

        commands.spawn((
            TileTextureFragmentMarker(handle),
            HillshadeTextureMarker, // Mark this as a hillshade texture for backfill system
            DataRequester::from_store(url, buf, extension),
            OrderByDistance {
                sse: leaf.sse,
                distance: leaf.distance_from_camera,
            },
            priority,
        ))
    } else {
        // Regular texture: continue using TextureFragment (no change to existing functionality)
        commands.spawn((
            TileTextureFragmentMarker(handle),
            TextureFragment::new(url),
            OrderByDistance {
                sse: leaf.sse,
                distance: leaf.distance_from_camera,
            },
            priority,
        ))
    };

    let id = entity.id();

    if is_hillshade {
        // Store hillshade entity in dedicated array for efficient neighbor lookup
        leaf.hillshade_entity_ids
            .get_or_insert_with(|| Vec::with_capacity(tiles_len))
            .push(Some(id));

        // Push None to texture_fragment_entity_ids to maintain index alignment
        leaf.texture_fragment_entity_ids
            .get_or_insert_with(|| Vec::with_capacity(tiles_len))
            .push(None);
    } else {
        // Regular texture: store in texture_fragment_entity_ids only
        leaf.texture_fragment_entity_ids
            .get_or_insert_with(|| Vec::with_capacity(tiles_len))
            .push(Some(id));

        // Push None to hillshade_entity_ids to maintain index alignment
        leaf.hillshade_entity_ids
            .get_or_insert_with(|| Vec::with_capacity(tiles_len))
            .push(None);
    }
}
