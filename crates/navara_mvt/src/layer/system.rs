use std::collections::HashMap;

use bevy_ecs::{
    entity::Entity,
    query::{Added, Without},
    system::{Commands, Query, Res, ResMut},
};

use navara_component::Deleted;
use navara_core::is_pmtiles_url;
use navara_feature_component::{
    batch::BatchedFeature, id::FeatureId, polygon::UpdatePolygon, render::RenderableFeature,
};
use navara_layer::{DeleteMvtLayerMarker, LayerId, LayerStore, MvtLayer, UpdateMvtLayerMarker};
use navara_material::Appearance;
use navara_tile_component::VectorTileQuadtree;
use navara_vector_tile::{
    LayerResources, RenderedTile, TileCacheManager, TileSource, VectorTileSource,
    VectorTileSourceCache, VectorTileSourceResources,
};

use crate::pmtiles_source::PmtilesSource;
use crate::source::{MvtSource, OwnedMatchedLayerInfo};
use crate::source_cache::MvtSourceId;

/// Prepares layer resources for newly added MVT layers.
pub fn prepare_layer_resource(
    mut commands: Commands,
    mvt_layers: Query<(Entity, &MvtLayer), Added<MvtLayer>>,
    mut source_cache: ResMut<VectorTileSourceCache>,
    mut source_query: Query<(&mut VectorTileSourceResources, Option<&mut TileSource>)>,
) {
    let mut layer_source_map: HashMap<navara_vector_tile::SourceId, Vec<Entity>> = HashMap::new();

    for (layer_entity, layer) in &mvt_layers {
        // Accept both `{z}/{x}/{y}` tile templates (MvtSource) and `.pmtiles`
        // archive URLs (PmtilesSource); skip anything else.
        if !layer.has_template_url() && !layer.is_pmtiles() {
            continue;
        }
        let Some(source_id) = navara_vector_tile::SourceId::from_mvt_layer(layer) else {
            continue;
        };
        layer_source_map
            .entry(source_id)
            .or_default()
            .push(layer_entity);
    }

    for (source_id, layer_entities) in layer_source_map {
        if let Some(existing) = source_cache.get_source(&source_id) {
            if let Ok((mut source, mut tile_source)) = source_query.get_mut(existing) {
                let quadtree = source.quadtree;
                let tile_cache_manager = source.tile_cache_manager;

                for &layer_entity in &layer_entities {
                    source.add_layer_ref(layer_entity);
                    let layer_id = mvt_layers
                        .get(layer_entity)
                        .map(|(_, l)| l.layer_id.clone())
                        .unwrap_or_default();
                    // Add layer info to the source (MVT or PMTiles — both keep
                    // the same `layers` list).
                    if let Ok((_, layer)) = mvt_layers.get(layer_entity)
                        && let Some(ts) = tile_source.as_mut()
                    {
                        push_layer_info(ts, owned_layer_info(layer));
                    }
                    commands.entity(layer_entity).insert(LayerResources {
                        layer_id,
                        source: existing,
                        quadtree,
                        tile_cache_manager,
                    });
                }
            }
        } else {
            let owned_layers: Vec<OwnedMatchedLayerInfo> = layer_entities
                .iter()
                .filter_map(|&e| {
                    mvt_layers
                        .get(e)
                        .ok()
                        .map(|(_, layer)| owned_layer_info(layer))
                })
                .collect();

            let (source_entity, quadtree, tile_cache_manager) = create_new_source(
                &mut commands,
                &mut source_cache,
                source_id,
                layer_entities.clone(),
                owned_layers,
            );

            for layer_entity in layer_entities {
                let layer_id = mvt_layers
                    .get(layer_entity)
                    .map(|(_, l)| l.layer_id.clone())
                    .unwrap_or_default();
                commands.entity(layer_entity).insert(LayerResources {
                    layer_id,
                    source: source_entity,
                    quadtree,
                    tile_cache_manager,
                });
            }
        }
    }
}

/// Run `f` against a source's layer list, regardless of whether it's an
/// [`MvtSource`] or a [`PmtilesSource`] (both hold `Vec<OwnedMatchedLayerInfo>`).
///
/// Uses a callback rather than returning `&mut Vec` so the transient downcast
/// borrow doesn't escape — returning it conditionally trips the borrow checker.
fn with_source_layers<R>(
    tile_source: &mut TileSource,
    f: impl FnOnce(&mut Vec<OwnedMatchedLayerInfo>) -> R,
) -> Option<R> {
    if let Some(s) = tile_source.downcast_mut::<MvtSource>() {
        return Some(f(&mut s.layers));
    }
    if let Some(s) = tile_source.downcast_mut::<PmtilesSource>() {
        return Some(f(&mut s.layers));
    }
    None
}

/// Append a layer's info to whichever source kind backs `tile_source`.
fn push_layer_info(tile_source: &mut TileSource, info: OwnedMatchedLayerInfo) {
    with_source_layers(tile_source, |layers| layers.push(info));
}

/// Drop the layer `layer_id` from the source so new tiles stop generating its geometry.
fn retain_layers_except(tile_source: &mut TileSource, layer_id: &str) {
    with_source_layers(tile_source, |layers| {
        layers.retain(|l| l.layer_id != layer_id);
    });
}

/// Apply an appearance update to the matching layer inside the source.
fn set_layer_appearances(tile_source: &mut TileSource, layer_id: &str, appearance: &Appearance) {
    with_source_layers(tile_source, |layers| {
        for owned in layers {
            if owned.layer_id == layer_id {
                for a in &mut owned.appearances {
                    a.set(appearance);
                }
            }
        }
    });
}

fn owned_layer_info(layer: &MvtLayer) -> OwnedMatchedLayerInfo {
    let limit_layers = layer
        .vector_tile_appearance()
        .map(|vt| &vt.layers)
        .unwrap_or(&None)
        .clone();
    OwnedMatchedLayerInfo {
        layer_id: layer.layer_id.clone(),
        appearances: layer.appearances.clone(),
        limit_layers,
    }
}

fn create_new_source(
    commands: &mut Commands,
    source_cache: &mut ResMut<VectorTileSourceCache>,
    source_id: navara_vector_tile::SourceId,
    layer_entities: Vec<Entity>,
    owned_layers: Vec<OwnedMatchedLayerInfo>,
) -> (Entity, Entity, Entity) {
    let quadtree = commands
        .spawn(VectorTileQuadtree::new_with_linear_qt())
        .id();
    let tile_cache_manager = commands.spawn(TileCacheManager::default()).id();

    let url = source_id.key.clone();

    // The URL form chooses the source implementation: a `.pmtiles` archive is
    // resolved through PmtilesSource, everything else is a `{z}/{x}/{y}` MVT
    // template. Both share the identical decode path downstream.
    let source: Box<dyn VectorTileSource> = if is_pmtiles_url(&url) {
        Box::new(PmtilesSource::new(url, owned_layers))
    } else {
        Box::new(MvtSource {
            url,
            layers: owned_layers,
        })
    };

    let source_entity = commands
        .spawn((
            VectorTileSourceResources::new(
                source_id.clone(),
                quadtree,
                tile_cache_manager,
                layer_entities,
            ),
            TileSource(source),
        ))
        .id();

    source_cache.register_source(source_id, source_entity);

    (source_entity, quadtree, tile_cache_manager)
}

pub fn update_mvt_layer(
    mut commands: Commands,
    mut layers: Query<(&mut MvtLayer, Option<&LayerResources>)>,
    layer_store: Res<LayerStore>,
    updated: Query<(Entity, &UpdateMvtLayerMarker)>,
    mut features: Query<&mut RenderableFeature, Without<Deleted>>,
    mut tile_sources: Query<&mut TileSource>,
) {
    for (e, u) in &updated {
        let layer_id = u.layer_id.clone();

        for (mut layer, layer_res) in &mut layers {
            if layer.layer_id != layer_id {
                continue;
            }

            for appearance in &mut layer.appearances {
                appearance.set(&u.appearance);
            }

            // Sync updated appearances to the source's layers for newly loaded tiles
            if let Some(layer_res) = layer_res
                && let Ok(mut tile_source) = tile_sources.get_mut(layer_res.source)
            {
                set_layer_appearances(&mut tile_source, &layer_id, &u.appearance);
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
                        if let RenderableFeature::Polyline {
                            render_info,
                            material,
                            ..
                        } = f.as_mut()
                        {
                            material.update(polyline);
                            render_info.should_recalculate_height = true;
                        }
                    }
                    Appearance::Polygon(polygon) => {
                        if let RenderableFeature::Polygon { .. } = f.as_ref() {
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
    layers: Query<(Entity, &MvtLayer, Option<&LayerResources>)>,
    feature_ids: Query<(&FeatureId, &LayerId)>,
    batched_features: Query<&BatchedFeature>,
    mut rendered_tiles: Query<&mut RenderedTile>,
    mut qts: Query<&mut VectorTileQuadtree>,
    tc: Query<&TileCacheManager>,
    mut sources: Query<&mut VectorTileSourceResources>,
    mut source_cache: ResMut<VectorTileSourceCache>,
    mut tile_sources: Query<&mut TileSource>,
) {
    for (e, d) in &deleted {
        layer_store.remove(&d.0);

        for (layer_entity, layer, resource) in &layers {
            if layer.layer_id != d.0 {
                continue;
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
                // Remove layer from the source's layers so new tiles won't generate geometry for it
                if let Ok(mut tile_source) = tile_sources.get_mut(resource.source) {
                    retain_layers_except(&mut tile_source, &d.0);
                }
            }
            commands.entity(layer_entity).despawn();
        }

        commands.entity(e).despawn();
    }
}
