use bevy_ecs::prelude::*;
use navara_buffer_store::BufferStore;
use navara_component::{Deleted, OrderByDistance, Priority, Rendered};
use navara_core::{TileXYZ, WGS84_64};
use navara_feature_component::{
    batch::BatchTable, batch::BatchedFeature, id::FeatureId, render::RenderableFeature,
};
use navara_fog::Fog;
use navara_frame::FrameManager;
use navara_globe::Globe;
use navara_math::Transform;

use navara_occluder::ellipsoidal_occluder::EllipsoidalOccluder;

use navara_camera::{CameraFrustum, CameraMarker};
use navara_layer::{LayerId, LayerStore, TerrainLayer};
use navara_tile_component::{TerrainInformationQuadtree, VectorTile, VectorTileQuadtree};
use navara_window::Window;
use rustc_hash::FxHashSet;

use crate::{
    VectorTileFeatureMarker, VectorTileSourceResources,
    data_requester::{ChangedVectorTileDataRequesterQuery, VectorTileDataRequesterQuery},
    layer::{resource::LayerResources, tile_cache_manager::TileCacheManager},
    source::TileSource,
};

use super::render::RenderedTile;
use super::traverse::{
    TraversalResult, activate_all_renderable_features, are_all_renderable_features_active,
    spawn_tile_entity, traverse_tile,
};

/// Generic tile update system that delegates to `TileSource::prepare_tile`.
///
/// Iterates all sources with a `TileSource` component, performing quadtree traversal
/// and tile preparation via the source's trait implementation.
#[allow(clippy::too_many_arguments, clippy::type_complexity)]
pub fn update_tiles(
    mut commands: Commands,
    terrain_qt: Res<TerrainInformationQuadtree>,
    mut qts: Query<&mut VectorTileQuadtree>,
    mut tcs: Query<&mut TileCacheManager>,
    mut buf: ResMut<BufferStore>,
    frame: Res<FrameManager>,
    window: Res<Window>,
    mut source_query: Query<(Ref<VectorTileSourceResources>, &mut TileSource), Without<Deleted>>,
    mut camera_set: ParamSet<(
        Query<(&CameraMarker, Ref<Transform>, &CameraFrustum)>,
        Query<&Fog>,
    )>,
    mut data_requester: ParamSet<(
        VectorTileDataRequesterQuery,
        ChangedVectorTileDataRequesterQuery,
    )>,
    occluder: Query<&EllipsoidalOccluder>,
    rendered_tiles: Query<&RenderedTile>,
    mut features: ParamSet<(
        Query<&FeatureId, With<VectorTileFeatureMarker>>,
        Query<&FeatureId, (With<VectorTileFeatureMarker>, Changed<FeatureId>)>,
    )>,
    mut renderable_features: ParamSet<(
        Query<&mut RenderableFeature>,
        // TODO: This detects all `RenderableFeature` that has `Rendered`, but this isn't efficient.
        //       We should use another marker to detect if it is MVT's RenderableFeature.
        Query<(), (With<RenderableFeature>, Changed<Rendered>)>,
    )>,
    terrain_layer: Query<&TerrainLayer>,
    globe: Res<Globe>,
) {
    let is_data_requester_changed = !data_requester.p1().is_empty();
    let are_features_changed = !features.p1().is_empty();
    let are_renderable_features_rendered = !renderable_features.p1().is_empty();

    let occluder = occluder.iter().next().unwrap();

    let fog = camera_set.p1().single().unwrap().clone();
    let camera = camera_set.p0();

    // TODO: Think how to support multiple terrain layer.(Is it possible?)
    let terrain_layer = terrain_layer.iter().next();

    let mut renderable_features = renderable_features.p0();
    let data_requester = data_requester.p0();
    let features = features.p0();

    for (source, mut tile_source) in &mut source_query {
        let Ok(mut qt) = qts.get_mut(source.quadtree) else {
            continue;
        };
        let Ok(mut tc) = tcs.get_mut(source.tile_cache_manager) else {
            continue;
        };

        for (_, camera, frustum) in &camera {
            let needs_update = is_data_requester_changed
                || tc.needs_update
                || camera.is_added()
                || camera.is_changed()
                || are_features_changed
                || are_renderable_features_rendered
                || source.is_added()
                || terrain_qt.is_changed();
            if !needs_update {
                continue;
            }

            tc.needs_update = false;

            tc.is_updated_in_this_frame = true;
            tc.last_rendered_frame = frame.rendered_frame();

            let zero_tile = match qt.qt.zero() {
                Some(z) => z,
                None => {
                    qt.qt
                        .initialize_zero(&|(x, y, z)| VectorTile::new(TileXYZ { x, y, z }, 0., 0.));
                    qt.qt
                        .zero()
                        .expect("Failed to initialize a level zero tile unexpectedly")
                }
            };
            let zero_tile_handle = zero_tile.handle();
            let is_rendered = matches!(
                are_all_renderable_features_active(
                    &tc,
                    &zero_tile_handle,
                    &rendered_tiles,
                    &features,
                    &mut renderable_features,
                ),
                Some(true)
            );

            qt.qt.get_mut(zero_tile_handle).unwrap().is_rendered = false;

            match traverse_tile(
                &mut commands,
                &source.source_id,
                zero_tile_handle,
                &mut qt,
                &mut tc,
                &frame,
                &camera,
                frustum,
                &window,
                &WGS84_64,
                occluder,
                &data_requester,
                &rendered_tiles,
                &features,
                &mut renderable_features,
                &fog,
                false,
                &terrain_layer,
                &terrain_qt,
                is_rendered.then_some(zero_tile_handle),
                &globe,
                &mut *tile_source.0,
                &mut buf,
            ) {
                TraversalResult::TileRendered => {
                    spawn_tile_entity(
                        &mut commands,
                        &mut tc,
                        qt.qt.get_mut(zero_tile_handle).unwrap(),
                        &frame,
                        zero_tile_handle,
                    );
                    activate_all_renderable_features(
                        &tc,
                        &zero_tile_handle,
                        &rendered_tiles,
                        &features,
                        &mut renderable_features,
                        true,
                    );

                    qt.qt.get_mut(zero_tile_handle).unwrap().is_rendered = is_rendered;
                }
                TraversalResult::NotFound => {
                    let tile = qt.qt.get_mut(zero_tile_handle).unwrap();
                    tile_source.0.prepare_tile(
                        &mut commands,
                        tile,
                        zero_tile_handle,
                        &mut tc,
                        &mut buf,
                        &data_requester,
                        Priority::Medium,
                    );
                }
                TraversalResult::ChildrenMeshPrepared => {
                    activate_all_renderable_features(
                        &tc,
                        &zero_tile_handle,
                        &rendered_tiles,
                        &features,
                        &mut renderable_features,
                        false,
                    );
                }
                _ => {}
            };
        }
    }
}

/// Generic mesh transfer system that delegates to `TileSource::construct_geometry`.
///
/// For each newly-rendered tile, calls the source's `construct_geometry` to create
/// feature entities, then inserts the `Rendered` marker.
#[allow(clippy::too_many_arguments, clippy::type_complexity)]
pub fn transfer_mesh(
    mut commands: Commands,
    mut batch_table: ResMut<BatchTable>,
    mut buf: ResMut<BufferStore>,
    qts: Query<&VectorTileQuadtree>,
    tcs: Query<&TileCacheManager>,
    mut source_query: Query<(&VectorTileSourceResources, &mut TileSource), Without<Deleted>>,
    mut rendered_tiles: Query<(Entity, &mut RenderedTile, &OrderByDistance), Without<Rendered>>,
    data_requester: VectorTileDataRequesterQuery,
) {
    for (source, mut tile_source) in &mut source_query {
        let Ok(qt) = qts.get(source.quadtree) else {
            continue;
        };
        let Ok(tc) = tcs.get(source.tile_cache_manager) else {
            continue;
        };

        if !tc.is_updated_in_this_frame {
            continue;
        }

        for (rendered_tile_id, mut rendered_tile, order) in
            rendered_tiles.iter_mut().sort::<&OrderByDistance>()
        {
            let needs_update = rendered_tile.is_added();
            if !needs_update {
                continue;
            }

            if !tc.has_same_rendered_tile(&rendered_tile.tile_handle, &rendered_tile_id) {
                continue;
            }

            let tile = qt.qt.get(rendered_tile.tile_handle).unwrap();

            commands.entity(rendered_tile_id).insert(Rendered);

            let data_req = tile
                .data_requester_entity_id
                .and_then(|e| data_requester.get(e).ok())
                .map(|(_, dr)| dr);

            if let Some(feature_ids) = tile_source.0.construct_geometry(
                &mut commands,
                &mut batch_table,
                &mut buf,
                tile,
                rendered_tile.tile_handle,
                order,
                data_req,
            ) {
                if rendered_tile.feature_ids.is_some() {
                    panic!("It should be cleaned before new feature is added");
                }
                rendered_tile.feature_ids = Some(feature_ids);
            }
        }
    }
}

/// Clears tile caches for tiles that are no longer visible.
#[allow(clippy::too_many_arguments)]
pub fn clear_caches(
    mut commands: Commands,
    mut layer_store: ResMut<LayerStore>,
    mut qts: Query<&mut VectorTileQuadtree>,
    mut tcs: Query<&mut TileCacheManager>,
    layers: Query<&LayerResources>,
    mut rendered_tiles: Query<(Entity, &mut RenderedTile, &OrderByDistance)>,
    batched_features: Query<&BatchedFeature>,
    features: Query<(&FeatureId, &LayerId)>,
    mut tile_sources: Query<&mut TileSource>,
) {
    // Track which sources we've already processed to avoid duplicate work.
    let mut processed_sources = FxHashSet::default();

    for resources in &layers {
        // Skip if we've already processed this source
        if !processed_sources.insert(resources.source) {
            continue;
        }

        let Ok(mut qt) = qts.get_mut(resources.quadtree) else {
            continue;
        };
        let Ok(mut tc) = tcs.get_mut(resources.tile_cache_manager) else {
            continue;
        };

        if !tc.is_updated_in_this_frame {
            continue;
        }

        // Clean up rendered tiles that are no longer visited
        for (rendered_tile_entity_id, mut rendered_tile, _) in
            rendered_tiles.iter_mut().sort::<&OrderByDistance>().rev()
        {
            if !tc.has_same_rendered_tile(&rendered_tile.tile_handle, &rendered_tile_entity_id) {
                continue;
            }

            let visited_at = {
                let tile = qt.qt.get(rendered_tile.tile_handle).unwrap();
                tile.visited_at
            };

            if tc.last_rendered_frame <= visited_at {
                continue;
            }

            commands.entity(rendered_tile_entity_id).despawn();
            tc.rendered_tile_caches.remove(&rendered_tile.tile_handle);
            tc.requested_tile_caches.remove(&rendered_tile.tile_handle);

            let removed_by_layer =
                rendered_tile.destroy(&mut commands, &features, &batched_features);
            qt.qt
                .remove(rendered_tile.tile_handle)
                .unwrap()
                .destroy(&mut commands);

            if let Ok(mut ts) = tile_sources.get_mut(resources.source) {
                ts.0.evict_tile(rendered_tile.tile_handle);
            }

            // Remove features from each layer's store
            for (layer_id, removed_features) in removed_by_layer {
                layer_store.remove_features(&layer_id, &removed_features);
            }
        }

        // Clean up requested tiles that are no longer visited
        let mut removed_handles = vec![];
        for (handle, _requested) in tc.requested_tile_caches.iter() {
            let tile_handle = *handle;

            let visited_at = {
                let tile = qt.qt.get(tile_handle).unwrap();
                tile.visited_at
            };

            if tc.last_rendered_frame <= visited_at {
                continue;
            }

            qt.qt.remove(tile_handle).unwrap().destroy(&mut commands);
            if let Ok(mut ts) = tile_sources.get_mut(resources.source) {
                ts.0.evict_tile(tile_handle);
            }

            removed_handles.push(tile_handle);
        }

        for removed in removed_handles {
            tc.requested_tile_caches.remove(&removed);
        }
    }

    // Reset the update flag for all sources - need to iterate again since
    // we may have skipped some sources above due to !is_updated_in_this_frame
    let mut reset_sources = FxHashSet::default();
    for resources in &layers {
        if reset_sources.insert(resources.source)
            && let Ok(mut tc) = tcs.get_mut(resources.tile_cache_manager)
        {
            tc.is_updated_in_this_frame = false;
        }
    }
}
