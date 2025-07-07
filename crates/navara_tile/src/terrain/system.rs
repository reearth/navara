use bevy_ecs::prelude::*;
use navara_buffer_store::BufferStore;
use navara_core::LngLat;
use navara_event_store::EventStore;
use navara_math::{EqualEpsilon, EPSILON3};
use navara_tile_component::RasterTileQuadtree;
use navara_tile_component::{
    compute_terrain_height_at_point, TerrainHeightObserver, TileMeshMarker,
    TileTerrainDataRequesterQuery,
};

pub fn update_height_observers(
    mut events: ResMut<EventStore>,
    mut qt: ResMut<RasterTileQuadtree>,
    mut buf: ResMut<BufferStore>,
    mut query: Query<(Entity, &mut TerrainHeightObserver)>,
    tile_meshes: Query<&TileMeshMarker, Added<TileMeshMarker>>,
    terrain_data_requester: TileTerrainDataRequesterQuery,
) {
    if tile_meshes.is_empty() {
        return;
    }

    for (entity, mut observer) in query.iter_mut() {
        let terrain_height = compute_terrain_height_at_point(
            &mut qt,
            &mut buf,
            &terrain_data_requester,
            &LngLat::new(observer.lle.lat.val(), observer.lle.lng.val()),
        );

        // Update observer height only if it has changed significantly
        if !observer.height.equal_diff_epsilon(terrain_height, EPSILON3) {
            observer.height = terrain_height;

            events.update_sample_terrain_height.push(entity);
        }
    }
}
