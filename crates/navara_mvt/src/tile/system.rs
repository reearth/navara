use bevy_ecs::prelude::*;
use navara_buffer_store::BufferStore;
use navara_component::{OrderByDistance, Priority, Rendered};
use navara_core::{TileXYZ, WGS84_64};
use navara_feature_component::{
    batch::{BatchTable, BatchedFeature},
    id::FeatureId,
    render::RenderableFeature,
};
use navara_fog::Fog;
use navara_frame::FrameManager;
use navara_globe::Globe;
use navara_math::Transform;

use navara_occluder::ellipsoidal_occluder::EllipsoidalOccluder;

use navara_camera::{CameraFrustum, CameraMarker};
use navara_tile_component::{TerrainInformationQuadtree, VectorTile, VectorTileQuadtree};
use navara_window::Window;

use crate::{
    component::MVTFeatureMarker,
    data_requester::{ChangedMvtDataRequesterQuery, MvtDataRequesterQuery},
    geometry::construct_geometry,
    layer::{resource::LayerResources, tile_cache_manager::TileCacheManager},
};

use super::{
    render::RenderedTile,
    traverse::{
        activate_all_renderable_features, are_all_renderable_features_active,
        prepare_tile_resource, spawn_tile_entity, traverse_tile, TraversalResult,
    },
};

use navara_layer::{LayerStore, MvtLayer, TerrainLayer};

#[allow(clippy::too_many_arguments, clippy::type_complexity)]
pub fn update_tiles(
    mut commands: Commands,
    terrain_qt: Res<TerrainInformationQuadtree>,
    mut qts: Query<&mut VectorTileQuadtree>,
    mut tcs: Query<&mut TileCacheManager>,
    mut buf: ResMut<BufferStore>,
    frame: Res<FrameManager>,
    window: Res<Window>,
    tiles: Query<(&MvtLayer, Ref<LayerResources>)>,
    mut camera_set: ParamSet<(
        Query<(&CameraMarker, Ref<Transform>, &CameraFrustum)>,
        Query<&Fog>,
    )>,
    mut mvt_data_requester: ParamSet<(MvtDataRequesterQuery, ChangedMvtDataRequesterQuery)>,
    occluder: Query<&EllipsoidalOccluder>,
    rendered_tiles: Query<&RenderedTile>,
    mut features: ParamSet<(
        Query<&FeatureId, With<MVTFeatureMarker>>,
        Query<&FeatureId, (With<MVTFeatureMarker>, Changed<FeatureId>)>,
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
    let is_data_requester_changed = !mvt_data_requester.p1().is_empty();
    let are_features_changed = !features.p1().is_empty();
    let are_renderable_features_rendered = !renderable_features.p1().is_empty();

    let occluder = occluder.iter().next().unwrap();

    let fog = camera_set.p1().single().unwrap().clone();
    let camera = camera_set.p0();

    // TODO: Think how to support multiple terrain layer.(Is it possible?)
    let terrain_layer = terrain_layer.iter().next();

    let mut renderable_features = renderable_features.p0();
    let mvt_data_requester = mvt_data_requester.p0();
    let features = features.p0();

    for (layer, resources) in &tiles {
        let Ok(mut qt) = qts.get_mut(resources.quadtree) else {
            continue;
        };
        let Ok(mut tc) = tcs.get_mut(resources.tile_cache_manager) else {
            continue;
        };

        for (_, camera, frustum) in &camera {
            let needs_update = is_data_requester_changed
                || tc.is_updated_in_this_frame
                || camera.is_added()
                || camera.is_changed()
                || are_features_changed
                || are_renderable_features_rendered
                || resources.is_added()
                || terrain_qt.is_changed();
            if !needs_update {
                continue;
            }

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
                layer,
                zero_tile_handle,
                &mut qt,
                &mut tc,
                &mut buf,
                &frame,
                &camera,
                frustum,
                &window,
                &WGS84_64,
                occluder,
                &mvt_data_requester,
                &rendered_tiles,
                &features,
                &mut renderable_features,
                &fog,
                false,
                &terrain_layer,
                &terrain_qt,
                is_rendered.then_some(zero_tile_handle),
                &globe,
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
                    prepare_tile_resource(
                        &mut commands,
                        qt.qt.get_mut(zero_tile_handle).unwrap(),
                        &mut buf,
                        layer,
                        zero_tile_handle,
                        &mut tc,
                        &mvt_data_requester,
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

fn attach_rendered(commands: &mut Commands, e: Entity) {
    commands.entity(e).insert(Rendered);
}

#[allow(clippy::too_many_arguments, clippy::type_complexity)]
pub fn transfer_mesh(
    mut commands: Commands,
    mut batch_table: ResMut<BatchTable>,
    mut buf: ResMut<BufferStore>,
    mut qts: Query<&mut VectorTileQuadtree>,
    mut tcs: Query<&mut TileCacheManager>,
    layers: Query<(&MvtLayer, &LayerResources)>,
    mut rendered_tiles: Query<(Entity, &mut RenderedTile, &OrderByDistance), Without<Rendered>>,
    mvt_data_requester: MvtDataRequesterQuery,
) {
    for (layer, resources) in &layers {
        let Ok(qt) = qts.get_mut(resources.quadtree) else {
            continue;
        };
        let Ok(tc) = tcs.get_mut(resources.tile_cache_manager) else {
            continue;
        };

        if !tc.is_updated_in_this_frame {
            continue;
        }

        let limit_layers = layer
            .vector_tile_appearance()
            .map(|vt| &vt.layers)
            .unwrap_or(&None);

        for (rendered_tile_id, mut rendered_tile, _) in
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

            attach_rendered(&mut commands, rendered_tile_id);

            let (_, data_requester) = mvt_data_requester
                .get(tile.data_requester_entity_id.unwrap())
                .unwrap();
            let mvt_bin = buf.remove_u8(&data_requester.handle).unwrap();
            if let Some(feature_ids) = construct_geometry(
                &mut commands,
                &mut batch_table,
                &mut buf,
                mvt_bin,
                tile.coords,
                &layer.appearances,
                limit_layers,
                &layer.layer_id,
                Some((rendered_tile.tile_handle, tile.extent)),
            ) {
                if rendered_tile.feature_ids.is_some() {
                    panic!("It should be cleaned before new feature is added");
                }
                rendered_tile.feature_ids = Some(feature_ids);
            }
        }
    }
}

#[allow(clippy::too_many_arguments)]
pub fn clear_caches(
    mut commands: Commands,
    mut layer_store: ResMut<LayerStore>,
    mut qts: Query<&mut VectorTileQuadtree>,
    mut tcs: Query<&mut TileCacheManager>,
    layers: Query<(&MvtLayer, &LayerResources)>,
    mut rendered_tiles: Query<(Entity, &mut RenderedTile, &OrderByDistance)>,
    batched_features: Query<&BatchedFeature>,
    features: Query<&FeatureId>,
) {
    for (rendered_tile_entity_id, mut rendered_tile, _) in
        rendered_tiles.iter_mut().sort::<&OrderByDistance>().rev()
    {
        for (layer, resources) in &layers {
            let Ok(mut qt) = qts.get_mut(resources.quadtree) else {
                continue;
            };
            let Ok(mut tc) = tcs.get_mut(resources.tile_cache_manager) else {
                continue;
            };

            if !tc.is_updated_in_this_frame {
                continue;
            }

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

            let removed_features =
                rendered_tile.destroy(&mut commands, &features, &batched_features);
            qt.qt
                .remove(rendered_tile.tile_handle)
                .unwrap()
                .destroy(&mut commands);
            layer_store.remove_features(&layer.layer_id, &removed_features);
        }
    }

    for (_, resources) in &layers {
        let Ok(mut qt) = qts.get_mut(resources.quadtree) else {
            continue;
        };
        let Ok(mut tc) = tcs.get_mut(resources.tile_cache_manager) else {
            continue;
        };

        if !tc.is_updated_in_this_frame {
            continue;
        }

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

            removed_handles.push(tile_handle);
        }

        for removed in removed_handles {
            tc.requested_tile_caches.remove(&removed);
        }
    }

    for (_, resources) in &layers {
        let Ok(mut tc) = tcs.get_mut(resources.tile_cache_manager) else {
            continue;
        };
        tc.is_updated_in_this_frame = false;
    }
}
