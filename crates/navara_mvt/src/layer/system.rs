use bevy_ecs::{
    component::Component,
    entity::Entity,
    query::{Added, Changed, Without},
    system::{Commands, Query, Res, ResMut},
};

use navara_buffer_store::BufferStore;
use navara_component::Deleted;
use navara_core::{calc_transform, get_tile_pos_from_url};
use navara_data_requester::{DataRequester, DataRequesterStatus};
use navara_feature_component::{
    batch::{BatchId, BatchTable, BatchedFeature, IdPropertySelections, IdPropertyTable},
    id::FeatureId,
    point::PointMarker,
    polygon::{PolygonMarker, UpdatePolygon},
    polyline::PolylineMarker,
    render::RenderableFeature,
};
use navara_layer::{DeleteMvtLayerMarker, LayerId, LayerStore, MvtLayer, UpdateMvtLayerMarker};
use navara_material::Appearance;
use navara_tile_component::VectorTileQuadtree;

use crate::{
    data_requester::SingleMvtDataRequesterMarker,
    geometry::{construct_geometry, ConstructedGeometryType},
    tile::RenderedTile,
};

use super::{resource::LayerResources, tile_cache_manager::TileCacheManager};

pub fn prepare_layer_resource(
    mut commands: Commands,
    mvt_layers: Query<(Entity, &MvtLayer), Added<MvtLayer>>,
) {
    for (e, layer) in &mvt_layers {
        if !layer.has_template_url() {
            continue;
        }

        let quadtree = commands
            .spawn(VectorTileQuadtree::new_with_linear_qt())
            .id();
        let tc = commands.spawn(TileCacheManager::default()).id();
        commands.entity(e).insert(LayerResources {
            quadtree,
            tile_cache_manager: tc,
        });
    }
}

#[derive(Component)]
pub struct RenderedSingleFeature(Entity);

#[allow(clippy::type_complexity)]
pub fn construct_single_mvt(
    mut commands: Commands,
    mut batch_table: ResMut<BatchTable>,
    mut id_prop_table_res: ResMut<IdPropertyTable>,
    mut buf: ResMut<BufferStore>,
    id_prop_sel_res: Res<IdPropertySelections>,
    requesters: Query<
        (Entity, &SingleMvtDataRequesterMarker, &DataRequester),
        (Changed<DataRequester>, Without<Deleted>),
    >,
    mvt_layers: Query<(Entity, &MvtLayer)>,
) {
    for (e, marker, req) in &requesters {
        // TODO: Handle fail
        if !matches!(req.status, DataRequesterStatus::Success) {
            continue;
        }
        let (layer_entity, layer) = match mvt_layers.get(marker.0) {
            Ok(l) => l,
            Err(_) => {
                commands.entity(e).despawn();
                continue;
            }
        };

        let limit_layers = layer
            .vector_tile_appearance()
            .map(|vt| &vt.layers)
            .unwrap_or(&None);

        commands.entity(e).despawn();

        let mvt_bin = match buf.remove_u8(&req.handle) {
            Some(b) => b,
            None => continue,
        };

        // TODO: Move this process to worker.
        if let Some(geometries) = construct_geometry(
            &mut commands,
            &mut batch_table,
            &mut id_prop_table_res,
            &mut buf,
            mvt_bin,
            &id_prop_sel_res,
            &layer.layer_id,
            get_tile_pos_from_url(&layer.data.as_ref().unwrap().url).unwrap(),
            &layer.appearances,
            limit_layers,
        ) {
            for v in geometries {
                let batched = BatchedFeature {
                    features: v.feature_ids,
                    ..Default::default()
                };
                let e = match v.geometry_type {
                    ConstructedGeometryType::Point => commands.spawn((PointMarker, batched)).id(),
                    ConstructedGeometryType::Polyline => {
                        commands.spawn((PolylineMarker, batched)).id()
                    }
                    ConstructedGeometryType::Polygon => {
                        commands.spawn((PolygonMarker, batched)).id()
                    }
                };
                commands
                    .entity(layer_entity)
                    .insert(RenderedSingleFeature(e));
            }
        };

        buf.remove(&req.handle);
    }
}

pub fn update_mvt_layer(
    mut commands: Commands,
    mut layers: Query<&mut MvtLayer>,
    layer_store: Res<LayerStore>,
    updated: Query<(Entity, &UpdateMvtLayerMarker)>,
    mut features: Query<&mut RenderableFeature>,
) {
    for (e, u) in &updated {
        let layer_id = u.layer_id.clone();

        for mut layer in &mut layers {
            if layer.layer_id != layer_id {
                continue;
            }

            for appearance in &mut layer.appearances {
                appearance.set(&u.appearance);
            }
        }

        if let Some(ids) = layer_store.get(&layer_id) {
            for id in ids {
                let mut f = match features.get_mut(*id) {
                    Ok(f) => f,
                    Err(_) => continue,
                };

                match &u.appearance {
                    Appearance::Point(pt) => {
                        if let RenderableFeature::Point {
                            coordinates,
                            crs,
                            material,
                            transform,
                            render_info,
                            ..
                        } = f.as_mut()
                        {
                            let should_update_transform =
                                material.height != pt.height || material.size != pt.size;
                            *material = pt.clone();
                            render_info.should_recalculate_height = true;
                            if should_update_transform {
                                *transform = calc_transform(
                                    coordinates,
                                    crs,
                                    material.height,
                                    material.size,
                                    false,
                                );
                            }
                        }
                    }
                    Appearance::Billboard(pt) => {
                        if let RenderableFeature::Billboard {
                            coordinates,
                            crs,
                            material,
                            transform,
                            render_info,
                            ..
                        } = f.as_mut()
                        {
                            let should_update_transform =
                                material.height != pt.height || material.size != pt.size;
                            *material = pt.clone();
                            render_info.should_recalculate_height = true;
                            if should_update_transform {
                                *transform = calc_transform(
                                    coordinates,
                                    crs,
                                    material.height,
                                    material.size,
                                    false,
                                );
                            }
                        }
                    }
                    Appearance::Polyline(polyline) => {
                        if let RenderableFeature::Polyline { material, .. } = f.as_mut() {
                            let internal = material.internal.take();
                            *material = polyline.clone();
                            material.internal = internal;
                        }
                    }
                    Appearance::Polygon(polygon) => {
                        if let RenderableFeature::Polygon { .. } = f.as_mut() {
                            commands.spawn(UpdatePolygon {
                                material: polygon.clone(),
                                feature_id: *id,
                            });
                        }
                    }
                    _ => {}
                }
            }
        }
        commands.entity(e).despawn();
    }
}

#[allow(clippy::type_complexity, clippy::too_many_arguments)]
pub fn delete_mvt_layer(
    mut commands: Commands,
    mut layer_store: ResMut<LayerStore>,
    deleted: Query<(Entity, &DeleteMvtLayerMarker)>,
    layers: Query<(
        Entity,
        &MvtLayer,
        Option<&RenderedSingleFeature>,
        Option<&LayerResources>,
    )>,
    mut buf: ResMut<BufferStore>,
    mut features: Query<&mut RenderableFeature>,
    feature_ids: Query<&FeatureId>,
    batched_features: Query<&BatchedFeature>,
    mut rendered_tiles: Query<&mut RenderedTile>,
    entities_with_layerid: Query<(Entity, &LayerId)>,
    mut qts: Query<&mut VectorTileQuadtree>,
    tc: Query<&TileCacheManager>,
    mut batch_table: ResMut<BatchTable>,
    mut id_prop_table_res: ResMut<IdPropertyTable>,
    batch_id: Query<&BatchId>,
) {
    for (e, d) in &deleted {
        let entities = layer_store.get(&d.0);
        if let Some(vec) = entities {
            // delete RenderableFeature and related Buffers
            for entity in vec {
                if let Ok(mut feature) = features.get_mut(*entity) {
                    feature.destroy(&mut buf);
                }

                commands.entity(*entity).despawn();
            }
        }

        // delete all entities with this layer id
        for (entity, l_id) in entities_with_layerid.iter() {
            if l_id.0 == d.0 {
                if batch_id.get(entity).is_ok() {
                    batch_table.remove(
                        &(batch_id.get(entity).unwrap().0.x as u32),
                        &mut id_prop_table_res,
                    );
                }
                commands.entity(entity).despawn();
            }
        }

        // delete stored layer id
        layer_store.remove(&d.0);

        for (e, l, rendered, resource) in &layers {
            if l.layer_id != d.0 {
                continue;
            }
            if let Some(rendered) = rendered {
                commands.entity(rendered.0).despawn();
            }
            if let Some(resource) = resource {
                resource.destroy(
                    &mut commands,
                    &mut buf,
                    &mut batch_table,
                    &mut id_prop_table_res,
                    &mut qts,
                    &tc,
                    &feature_ids,
                    &batched_features,
                    &mut features,
                    &mut rendered_tiles,
                    &batch_id,
                );
            }
            commands.entity(e).despawn();
        }

        commands.entity(e).despawn();
    }
}
