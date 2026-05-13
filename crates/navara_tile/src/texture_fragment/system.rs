use bevy_ecs::{
    entity::Entity,
    query::{Added, With, Without},
    system::{Commands, Query, ResMut},
};
use navara_component::{Deleted, Ignored, OrderByDistance, Priority, Requested};
use navara_texture_fragment::TextureFragment;
use navara_tile_component::{RasterTileQuadtree, TileTextureFragmentMarker};

use crate::hillshade::HillshadeTextureMarker;

const MAX_PENDINGS: u32 = 50;

#[allow(clippy::type_complexity)]
pub(crate) fn filter_requestable_texture_fragment(
    mut commands: Commands,
    mut qt: ResMut<RasterTileQuadtree>,
    fragments: Query<
        (
            Entity,
            &TileTextureFragmentMarker,
            &TextureFragment,
            &OrderByDistance,
            &Priority,
        ),
        (
            Added<TileTextureFragmentMarker>,
            Without<Deleted>,
            // Since layers and `texture_fragment_entity_ids` are referenced by index, we can't use this filter to prevent the order.
            // Without<Ignored>,
        ),
    >,
    requested_fragments: Query<
        Entity,
        (
            With<TileTextureFragmentMarker>,
            With<Requested>,
            Without<Deleted>,
            // Hillshade requests are rate-limited by filter_requestable_hillshade_data_requester,
            // so they must not be counted here.
            Without<HillshadeTextureMarker>,
        ),
    >,
) {
    let pendings = requested_fragments.iter().count();
    let num_skip = (MAX_PENDINGS as i32 - pendings as i32).max(0);

    // Limit the number of requests in this frame
    for (e, marker, _, _, _) in fragments
        .iter()
        .sort::<(&Priority, &OrderByDistance)>()
        .skip(num_skip as usize)
    {
        let handle = marker.0;
        let tile = qt.qt.get_mut(handle);
        if let Some(tile) = tile {
            commands.entity(e).insert((Deleted, Ignored));

            // Clear the rejected slot to None so the next request_texture_fragment
            // pass can re-spawn an entity for the same layer index.
            if let Some(tex_ids) = tile.texture_fragment_entity_ids.as_mut()
                && let Some(slot) = tex_ids
                    .iter_mut()
                    .find(|id| matches!(id, Some(id) if *id == e))
            {
                *slot = None;
            }
        }
    }
}
