use bevy_ecs::prelude::*;
use navara_buffer_store::BufferStore;
use navara_component::{OrderByDistance, Priority, Rendered};
use navara_core::{TileXYZ, WGS84_32};
use navara_feature_component::{
    batch::BatchedFeature, id::FeatureId, point::PointMarker, polygon::PolygonMarker,
    polyline::PolylineMarker, render::RenderableFeature,
};
use navara_frame::FrameManager;
use navara_math::Transform;

use navara_occluder::ellipsoidal_occluder::EllipsoidalOccluder;

use navara_camera::{CameraFrustum, CameraMarker};
use navara_tile_component::{VectorTile, VectorTileQuadtree};
use navara_window::Window;

use crate::{
    data_requester::{ChangedMvtDataRequesterQuery, MvtDataRequesterQuery},
    geometry::{construct_geometry, ConstructedGeometryType},
    layer::{resource::LayerResources, tile_cache_manager::TileCacheManager},
};

use super::{
    render::RenderedTile,
    traverse::{prepare_tile_resource, spawn_tile_entity, traverse_tile, TraversalResult},
};

use navara_layer::{LayerStore, MvtLayer};

#[allow(clippy::too_many_arguments, clippy::type_complexity)]
pub fn update_tiles(
    mut commands: Commands,
    mut qts: Query<&mut VectorTileQuadtree>,
    mut tcs: Query<&mut TileCacheManager>,
    mut buf: ResMut<BufferStore>,
    frame: Res<FrameManager>,
    window: Res<Window>,
    tiles: Query<(&MvtLayer, &LayerResources)>,
    camera: Query<(&CameraMarker, Ref<Transform>, &CameraFrustum)>,
    mvt_data_requester: MvtDataRequesterQuery,
    changed_mvt_data_requester: ChangedMvtDataRequesterQuery,
    occluder: Query<&EllipsoidalOccluder>,
) {
    let is_data_requester_changed = !changed_mvt_data_requester.is_empty();

    let occluder = occluder.iter().next().unwrap();

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
                || camera.is_changed();
            if !needs_update {
                continue;
            }

            tc.is_updated_in_this_frame = true;
            tc.last_rendered_frame = frame.rendered_frame();

            let zero_tile = match qt.qt.zero() {
                Some(z) => z,
                None => {
                    qt.qt
                        .initialize_zero(&|(x, y, z)| VectorTile::new(TileXYZ { x, y, z }, 0.));
                    qt.qt
                        .zero()
                        .expect("Failed to initialize a level zero tile unexpectedly")
                }
            };
            match traverse_tile(
                &mut commands,
                layer,
                zero_tile.handle(),
                &mut qt,
                &mut tc,
                &mut buf,
                &frame,
                &camera,
                frustum,
                &window,
                &WGS84_32,
                occluder,
                &mvt_data_requester,
            ) {
                TraversalResult::TileRendered => {
                    spawn_tile_entity(
                        &mut commands,
                        &mut tc,
                        qt.qt.get_mut(zero_tile.handle()).unwrap(),
                        &frame,
                        zero_tile.handle(),
                    );
                }
                TraversalResult::NotFound => {
                    prepare_tile_resource(
                        &mut commands,
                        qt.qt.get_mut(zero_tile.handle()).unwrap(),
                        &mut buf,
                        layer,
                        zero_tile.handle(),
                        &mut tc,
                        &mvt_data_requester,
                        Priority::High,
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
            if let Some(result) = construct_geometry(
                &mut commands,
                &mut buf,
                &mvt_bin,
                &layer.layer_id,
                tile.coords,
                &layer.appearances,
            ) {
                for v in result {
                    let batched = BatchedFeature {
                        features: v.feature_ids,
                        ..Default::default()
                    };
                    let e = match v.geometry_type {
                        ConstructedGeometryType::Point => {
                            commands.spawn((PointMarker, batched)).id()
                        }
                        ConstructedGeometryType::Polyline => commands
                            .spawn((PolylineMarker, batched, FeatureId::default()))
                            .id(),
                        ConstructedGeometryType::Polygon => commands
                            .spawn((PolygonMarker, batched, FeatureId::default()))
                            .id(),
                    };
                    rendered_tile.feature_id = Some(e);
                }
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
    mut buf: ResMut<BufferStore>,
    mut rendered_tiles: Query<(Entity, &mut RenderedTile, &OrderByDistance)>,
    batched_features: Query<&BatchedFeature>,
    features: Query<&FeatureId>,
    mut renderable_features: Query<&mut RenderableFeature>,
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

            let rendered_at = {
                let tile = qt.qt.get(rendered_tile.tile_handle).unwrap();
                tile.rendered_at
            };

            if tc.last_rendered_frame <= rendered_at {
                continue;
            }

            commands.entity(rendered_tile_entity_id).despawn();
            tc.rendered_tile_caches.remove(&rendered_tile.tile_handle);
            tc.requested_tile_caches.remove(&rendered_tile.tile_handle);

            let removed_features = rendered_tile.destroy(
                &mut commands,
                &mut buf,
                &features,
                &batched_features,
                &mut renderable_features,
            );
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
