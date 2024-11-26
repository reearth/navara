use bevy_ecs::{
    entity::Entity,
    query::Added,
    system::{Commands, Query, ResMut},
};
use navara_component::{Deleted, Ignored, OrderByDistance};
use navara_texture_fragment::TextureFragment;
use navara_tile_component::{TileQuadtree, TileTextureFragmentMarker};

pub(crate) fn filter_requestable_texture_fragment(
    mut commands: Commands,
    mut qt: ResMut<TileQuadtree>,
    fragments: Query<
        (
            Entity,
            &TileTextureFragmentMarker,
            &TextureFragment,
            &OrderByDistance,
        ),
        Added<TileTextureFragmentMarker>,
    >,
) {
    // Limit the number of requests in this frame
    for (e, marker, _, _) in fragments.iter().sort::<&OrderByDistance>().skip(10) {
        let handle = marker.0;
        let tile = qt.qt.get_mut(handle);
        if let Some(tile) = tile {
            commands.entity(e).insert((Deleted, Ignored));
            tile.texture_fragment_entity_id = None;
        }
    }
}
