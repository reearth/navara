use bevy_ecs::{
    entity::Entity,
    query::{Added, With, Without},
    system::{Commands, Query, ResMut},
};
use navara_component::{Deleted, Ignored, OrderByDistance, Priority, Requested};
use navara_texture_fragment::TextureFragment;
use navara_tile_component::{RasterTileQuadtree, TileTextureFragmentMarker};

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

            if let Some(ids) = tile.texture_fragment_entity_ids.as_mut() {
                let idx = ids
                    .iter()
                    .enumerate()
                    .find_map(|(i, id)| id.and_then(|id| (id == e).then_some(i)))
                    .unwrap();
                ids.remove(idx);
            }
        }
    }
}
