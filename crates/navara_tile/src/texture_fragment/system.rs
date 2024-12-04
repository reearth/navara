use bevy_ecs::{
    entity::Entity,
    query::{Added, With, Without},
    system::{Commands, Query, ResMut},
};
use navara_component::{Deleted, Ignored, OrderByDistance, Priority, Requested};
use navara_texture_fragment::TextureFragment;
use navara_tile_component::{RasterTileQuadtree, TileTextureFragmentMarker};

const MAX_PENDINGS: u32 = 10;

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
        (Added<TileTextureFragmentMarker>, Without<Deleted>),
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
            tile.texture_fragment_entity_id = None;
        }
    }
}
