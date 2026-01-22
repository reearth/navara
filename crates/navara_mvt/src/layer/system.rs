use std::collections::HashMap;

use bevy_ecs::{
    component::Component,
    entity::Entity,
    query::{Added, Changed, Without},
    system::{Commands, Query, Res, ResMut},
};

use navara_buffer_store::BufferStore;
use navara_component::Deleted;
use navara_core::get_tile_pos_from_url;
use navara_data_requester::{DataRequester, DataRequesterStatus};
use navara_feature_component::{
    batch::{BatchTable, BatchedFeature},
    id::FeatureId,
    polygon::UpdatePolygon,
    render::RenderableFeature,
};
use navara_layer::{DeleteMvtLayerMarker, LayerId, LayerStore, MvtLayer, UpdateMvtLayerMarker};
use navara_material::Appearance;
use navara_tile_component::VectorTileQuadtree;

use crate::{
    data_requester::SingleMvtDataRequesterMarker,
    geometry::construct_geometry,
    source_cache::{MvtSourceCache, MvtSourceResources, SourceId},
    tile::RenderedTile,
};

use super::{resource::LayerResources, tile_cache_manager::TileCacheManager};

/// Prepares layer resources for newly added MVT layers.
///
/// Layers are grouped by their `SourceId` (URL + traversal config). Layers with
/// the same URL but different traversal properties (e.g., different max_zoom or
/// clamp_to_ground settings) will get separate source resources.
pub fn prepare_layer_resource(
    mut commands: Commands,
    mvt_layers: Query<(Entity, &MvtLayer), Added<MvtLayer>>,
    mut source_cache: ResMut<MvtSourceCache>,
    mut source_query: Query<&mut MvtSourceResources>,
) {
    let mut layer_source_map: HashMap<SourceId, Vec<Entity>> = HashMap::new();

    for (layer_entity, layer) in &mvt_layers {
        if !layer.has_template_url() {
            continue;
        }
        let Some(source_id) = SourceId::from_layer(layer) else {
            continue;
        };
        layer_source_map
            .entry(source_id)
            .or_default()
            .push(layer_entity);
    }

    for (source_id, layer_entities) in layer_source_map {
        if let Some(existing) = source_cache.get_source(&source_id) {
            // Reuse existing source: add layer refs and wire LayerResources
            if let Ok(source) = source_query.get_mut(existing) {
                // Copy fields we need for inserting LayerResources
                let quadtree = source.quadtree;
                let tile_cache_manager = source.tile_cache_manager;

                // Add layer refs and attach resources
                for layer_entity in layer_entities {
                    // Update source's ref list
                    if let Ok(mut s) = source_query.get_mut(existing) {
                        s.add_layer_ref(layer_entity);
                    }
                    commands.entity(layer_entity).insert(LayerResources {
                        source: existing,
                        quadtree,
                        tile_cache_manager,
                    });
                }
            }
        } else {
            // Create new shared source resources
            let (source_entity, quadtree, tile_cache_manager) = create_new_source(
                &mut commands,
                &mut source_cache,
                source_id,
                layer_entities.clone(),
            );

            for layer_entity in layer_entities {
                commands.entity(layer_entity).insert(LayerResources {
                    source: source_entity,
                    quadtree,
                    tile_cache_manager,
                });
            }
        }
    }
}

/// Creates new source resources (quadtree, tile_cache_manager) and registers them.
fn create_new_source(
    commands: &mut Commands,
    source_cache: &mut ResMut<MvtSourceCache>,
    source_id: SourceId,
    layer_entities: Vec<Entity>,
) -> (Entity, Entity, Entity) {
    let quadtree = commands
        .spawn(VectorTileQuadtree::new_with_linear_qt())
        .id();
    let tile_cache_manager = commands.spawn(TileCacheManager::default()).id();

    let source_entity = commands
        .spawn(MvtSourceResources::new(
            source_id.clone(),
            quadtree,
            tile_cache_manager,
            layer_entities,
        ))
        .id();

    source_cache.register_source(source_id, source_entity);

    (source_entity, quadtree, tile_cache_manager)
}

#[derive(Component)]
pub struct RenderedSingleFeature(Entity);

#[allow(clippy::type_complexity)]
pub fn construct_single_mvt(
    mut commands: Commands,
    mut batch_table: ResMut<BatchTable>,
    mut buf: ResMut<BufferStore>,
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
        if let Some(entity_ids) = construct_geometry(
            &mut commands,
            &mut batch_table,
            &mut buf,
            mvt_bin,
            get_tile_pos_from_url(&layer.data.as_ref().unwrap().url).unwrap(),
            &layer.appearances,
            limit_layers,
            &layer.layer_id,
            None, // No tile info for single MVT files
        ) {
            // Store references to spawned entities
            for entity_id in entity_ids {
                commands
                    .entity(layer_entity)
                    .insert(RenderedSingleFeature(entity_id));
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
    mut features: Query<&mut RenderableFeature, Without<Deleted>>,
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
                            material,
                            transform,
                            render_info,
                            ..
                        } = f.as_mut()
                        {
                            material.update(pt, transform);
                            render_info.should_recalculate_height = true;
                        }
                    }
                    Appearance::Billboard(pt) => {
                        if let RenderableFeature::Billboard {
                            material,
                            transform,
                            render_info,
                            ..
                        } = f.as_mut()
                        {
                            material.update(pt, transform);
                            render_info.should_recalculate_height = true;
                        }
                    }
                    Appearance::Text(pt) => {
                        if let RenderableFeature::Text {
                            material,
                            render_info,
                            ..
                        } = f.as_mut()
                        {
                            material.update(pt);
                            render_info.should_recalculate_height = true;
                        }
                    }
                    Appearance::Polyline(polyline) => {
                        if let RenderableFeature::Polyline { material, .. } = f.as_mut() {
                            material.update(polyline);
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
    feature_ids: Query<(&FeatureId, &LayerId)>,
    batched_features: Query<&BatchedFeature>,
    mut rendered_tiles: Query<&mut RenderedTile>,
    mut qts: Query<&mut VectorTileQuadtree>,
    tc: Query<&TileCacheManager>,
    mut sources: Query<&mut MvtSourceResources>,
    mut source_cache: ResMut<MvtSourceCache>,
) {
    for (e, d) in &deleted {
        // delete stored layer id
        layer_store.remove(&d.0);

        for (layer_entity, layer, rendered, resource) in &layers {
            if layer.layer_id != d.0 {
                continue;
            }
            if let Some(rendered) = rendered {
                commands.entity(rendered.0).insert(Deleted);
            }
            if let Some(resource) = resource {
                resource.destroy(
                    layer_entity,
                    &LayerId(layer.layer_id.clone()),
                    &mut commands,
                    &mut qts,
                    &tc,
                    &feature_ids,
                    &batched_features,
                    &mut rendered_tiles,
                    &mut sources,
                    &mut source_cache,
                );
            }
            commands.entity(layer_entity).despawn();
        }

        commands.entity(e).despawn();
    }
}
